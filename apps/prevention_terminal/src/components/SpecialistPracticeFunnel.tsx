import React from "react";
import { t } from "../lib/i18n.ts";
import type { PracticeFunnel } from "../lib/specialist_dashboard_bundle.ts";
import type { SpecialistWorkspaceView } from "../lib/workspace_nav.ts";

interface SpecialistPracticeFunnelProps {
  funnel: PracticeFunnel;
  periodLabel: string;
  onNavigate?: (view: SpecialistWorkspaceView) => void;
}

export default function SpecialistPracticeFunnel({
  funnel,
  periodLabel,
  onNavigate,
}: SpecialistPracticeFunnelProps) {
  return (
    <section className="card dashboard-section specialist-practice-funnel" style={{ position: "relative" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "10px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: "8px", fontSize: "1.15rem" }}>
            <span>📊</span>
            <span>{t("Воронка практики и клиентов", "Practice & Client Funnel")}</span>
          </h3>
          <p className="muted tiny" style={{ margin: "4px 0 0" }}>
            {t("Сквозной путь клиента: от первой заявки до регулярных сессий и завершения ", "Client progression: from incoming lead to regular sessions & completion ")}
            · {periodLabel}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span
            style={{
              background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
              color: "#ffffff",
              fontSize: "0.82rem",
              fontWeight: 700,
              padding: "5px 12px",
              borderRadius: "20px",
              boxShadow: "0 2px 6px rgba(15, 118, 110, 0.25)",
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <span>🎯</span>
            <span>Retention {funnel.retentionRate}%</span>
          </span>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "10px",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            background: "var(--bg-page, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "10px",
            padding: "12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)", marginBottom: "4px" }}>
            {t("Загрузка практики", "Practice Load")}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f766e" }}>
            {funnel.practiceLoadPct}%
          </div>
          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
            {funnel.weeklyHours.current} / {funnel.weeklyHours.total} {t("ч в неделю", "h / week")}
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-page, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "10px",
            padding: "12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)", marginBottom: "4px" }}>
            {t("В регулярной работе", "In Regular Contract")}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0d9488" }}>
            {funnel.activeClientsCount} {t("клиентов", "clients")}
          </div>
          <div style={{ fontSize: "0.7rem", color: "#64748b" }}>
            {t("Контрактная терапия", "Contract therapy")}
          </div>
        </div>

        <div
          style={{
            background: "var(--bg-page, #f8fafc)",
            border: "1px solid var(--border, #e2e8f0)",
            borderRadius: "10px",
            padding: "12px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "var(--text-muted, #64748b)", marginBottom: "4px" }}>
            {t("Средний чек", "Average Fee")}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--text-main, #1e293b)" }}>
            {funnel.averageTicketRub.toLocaleString("ru-RU")} ₽
          </div>
          <div style={{ fontSize: "0.7rem", color: "#059669", fontWeight: 600 }}>
            {t("✓ Комиссия сервиса 0%", "✓ 0% platform fee")}
          </div>
        </div>

        <div
          style={{
            background: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)",
            border: "1px solid #99f6e4",
            borderRadius: "10px",
            padding: "12px",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}
        >
          <div style={{ fontSize: "0.75rem", color: "#0f766e", fontWeight: 700, marginBottom: "4px" }}>
            {t("Доход за месяц", "Monthly Revenue")}
          </div>
          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0f766e" }}>
            {funnel.monthRevenueRub.toLocaleString("ru-RU")} ₽
          </div>
          <div style={{ fontSize: "0.7rem", color: "#0d9488" }}>
            {t("Честный баланс без удержаний", "Direct payout without fees")}
          </div>
        </div>
      </div>

      {/* Visual Funnel Stages */}
      <div
        style={{
          background: "#ffffff",
          border: "1px solid var(--border, #e2e8f0)",
          borderRadius: "12px",
          padding: "16px",
          marginBottom: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "4px", borderBottom: "1px solid #f1f5f9" }}>
          <span style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#475569", letterSpacing: "0.04em" }}>
            {t("Этап движения клиента", "Client Stage")}
          </span>
          <span style={{ fontSize: "0.76rem", fontWeight: 700, textTransform: "uppercase", color: "#475569", letterSpacing: "0.04em" }}>
            {t("Объём и Конверсия", "Volume & Conversion")}
          </span>
        </div>

        {funnel.stages.map((stage) => {
          const isClickable = Boolean(stage.nav && onNavigate);
          return (
            <div
              key={stage.id}
              onClick={() => isClickable && stage.nav && onNavigate?.(stage.nav)}
              style={{
                cursor: isClickable ? "pointer" : "default",
                padding: "8px 10px",
                borderRadius: "8px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (isClickable) e.currentTarget.style.backgroundColor = "#f8fafc";
              }}
              onMouseLeave={(e) => {
                if (isClickable) e.currentTarget.style.backgroundColor = "transparent";
              }}
              title={isClickable ? t("Нажмите для перехода в раздел", "Click to view section") : undefined}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-main, #1e293b)" }}>
                  {stage.label}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <strong style={{ fontSize: "0.92rem", color: stage.color }}>
                    {stage.count}
                  </strong>
                  {stage.conversionText && (
                    <span style={{ fontSize: "0.75rem", color: "#64748b", background: "#f1f5f9", padding: "2px 6px", borderRadius: "4px" }}>
                      {stage.conversionText}
                    </span>
                  )}
                  {isClickable && (
                    <span style={{ fontSize: "0.8rem", color: "#94a3b8" }}>→</span>
                  )}
                </div>
              </div>

              {/* Progress Bar */}
              <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "4px", overflow: "hidden", marginBottom: "5px" }}>
                <div
                  style={{
                    width: stage.count > 0 ? `${Math.min(Math.max(stage.pct, 6), 100)}%` : "0%",
                    height: "100%",
                    background: stage.color,
                    borderRadius: "4px",
                    transition: "width 0.4s ease",
                  }}
                />
              </div>

              <div style={{ fontSize: "0.72rem", color: "#64748b" }}>
                {stage.hint}
              </div>
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {onNavigate && (
            <>
              <button
                type="button"
                className="ob-btn tiny"
                style={{
                  backgroundColor: "#0f766e",
                  color: "#ffffff",
                  fontWeight: 700,
                  padding: "7px 14px",
                  borderRadius: "6px",
                  border: "none",
                  cursor: "pointer",
                }}
                onClick={() => onNavigate("consultations")}
              >
                + {t("Новый клиент в работу", "Add Client")}
              </button>
              <button
                type="button"
                className="ob-btn secondary tiny"
                style={{
                  borderColor: "#0f766e",
                  color: "#0f766e",
                  fontWeight: 600,
                  padding: "7px 14px",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
                onClick={() => onNavigate("settings")}
              >
                📥 {t("Входящие заявки (Inbox)", "Incoming Leads (Inbox)")}
              </button>
            </>
          )}
        </div>

        <div style={{ fontSize: "0.74rem", color: "#64748b" }}>
          💡 {t("Каждый этап воронки связан с карточками клиентов и журналом", "Each funnel stage links to client cards and consultation log")}
        </div>
      </div>
    </section>
  );
}
