import { useState } from "react";
import { createPortal } from "react-dom";
import { t } from "../lib/i18n.ts";
import { useAcademyProgress, ACHIEVEMENTS, getRank } from "../lib/academy_progress.ts";

export default function AcademyGamificationWidget() {
  const progress = useAcademyProgress();
  const [showModal, setShowModal] = useState(false);

  const level = Math.floor(progress.points / 100) + 1;
  const xpInCurrentLevel = progress.points % 100;
  const rank = getRank(progress.points);
  
  const isEn = navigator.language.startsWith("en");

  return (
    <div className="gamification-bar" style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 16px",
      height: "38px",
      minHeight: "38px",
      background: "#ffffff",
      borderBottom: "1px solid var(--border-color, #e2e8f0)",
      fontSize: "0.8rem",
      color: "var(--text-main, #1e293b)",
      boxSizing: "border-box",
      flexShrink: 0
    }}>
      {/* Left: Rank & Level */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          padding: "3px 10px",
          borderRadius: "16px",
          background: "rgba(15, 118, 110, 0.08)",
          border: "1px solid rgba(15, 118, 110, 0.2)",
          color: "#0f766e",
          fontWeight: 700,
          fontSize: "0.8rem"
        }}>
          <span>{rank.icon}</span>
          <span>{isEn ? rank.en : rank.title}</span>
          <span style={{ opacity: 0.65, fontWeight: 500 }}>• {t("Ур.", "Lvl")} {level}</span>
        </div>

        {/* XP Mini Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "70px", height: "6px", background: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
            <div style={{
              height: "100%",
              width: `${xpInCurrentLevel}%`,
              background: "linear-gradient(90deg, #0f766e, #10b981)",
              borderRadius: "3px",
              transition: "width 0.4s ease"
            }} />
          </div>
          <span style={{ fontSize: "0.75rem", color: "#64748b", fontWeight: 600 }}>
            {xpInCurrentLevel}/100 XP
          </span>
          <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
            ({progress.points} {t("очков", "pts")})
          </span>
        </div>
      </div>

      {/* Right: Streak & Achievements Button */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        {/* Streak indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: "rgba(249, 115, 22, 0.1)",
          border: "1px solid rgba(249, 115, 22, 0.25)",
          borderRadius: "14px",
          padding: "2px 8px",
          color: "#ea580c",
          fontSize: "0.75rem",
          fontWeight: 700
        }} title={t("Серия дней активности", "Daily active streak")}>
          🔥 {progress.streak} {t("дн.", "d.")}
        </div>

        {/* Achievements trigger button */}
        <button 
          onClick={() => setShowModal(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            color: "#334155",
            borderRadius: "8px",
            padding: "4px 10px",
            fontSize: "0.75rem",
            fontWeight: 600,
            cursor: "pointer",
            transition: "all 0.2s"
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#f1f5f9"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#f8fafc"; e.currentTarget.style.borderColor = "#e2e8f0"; }}
        >
          <span>🏆</span>
          <span>{t("Достижения", "Badges")} ({progress.unlockedAchievements.length}/{ACHIEVEMENTS.length})</span>
        </button>
      </div>

      {/* Achievements Modal rendered at body level to prevent stacking context cut-through */}
      {showModal && typeof document !== "undefined" && createPortal(
        <div style={{
          position: "fixed",
          inset: 0,
          background: "rgba(15, 23, 42, 0.65)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 999999,
          backdropFilter: "blur(6px)"
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: "#ffffff",
            border: "1px solid #cbd5e1",
            borderRadius: "16px",
            padding: "24px",
            width: "90%",
            maxWidth: "480px",
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 25px 50px -12px rgba(0,0,0,0.35)",
            color: "#1e293b",
            position: "relative",
            zIndex: 1000000
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: "700", color: "#0f766e" }}>🏆 {t("Академические Достижения", "Academic Achievements")}</h3>
              <button 
                onClick={() => setShowModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "1.2rem",
                  cursor: "pointer",
                  padding: "4px"
                }}
              >✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {ACHIEVEMENTS.map(ach => {
                const unlocked = progress.unlockedAchievements.includes(ach.id);
                return (
                  <div key={ach.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    background: unlocked ? "rgba(15, 118, 110, 0.06)" : "#f8fafc",
                    border: unlocked ? "1px solid rgba(15, 118, 110, 0.25)" : "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "12px",
                    opacity: unlocked ? 1 : 0.5,
                    transition: "all 0.2s"
                  }}>
                    <span style={{
                      fontSize: "1.8rem",
                      filter: unlocked ? "none" : "grayscale(100%)",
                      transform: unlocked ? "scale(1.05)" : "none"
                    }}>{ach.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h5 style={{ margin: "0 0 2px 0", fontSize: "0.85rem", fontWeight: "700", color: unlocked ? "#0f766e" : "#64748b" }}>
                        {isEn ? ach.nameEn : ach.name}
                      </h5>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b", lineHeight: 1.3 }}>
                        {isEn ? ach.descEn : ach.desc}
                      </p>
                    </div>
                    {unlocked && (
                      <span style={{ fontSize: "0.7rem", color: "#0f766e", fontWeight: "700", background: "rgba(15, 118, 110, 0.1)", padding: "3px 8px", borderRadius: "6px" }}>✓ {t("Получено", "Unlocked")}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
