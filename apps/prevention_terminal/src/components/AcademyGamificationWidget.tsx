import { useState } from "react";
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
    <div className="gamification-widget" style={{
      background: "linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      borderRadius: "12px",
      padding: "16px",
      marginBottom: "20px",
      boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
      backdropFilter: "blur(10px)",
      color: "#f8fafc"
    }}>
      {/* Top Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "1.5rem" }}>{rank.icon}</span>
          <div>
            <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: "600", color: "#f1f5f9" }}>
              {isEn ? rank.en : rank.title}
            </h4>
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              {t("Уровень", "Level")} {level}
            </span>
          </div>
        </div>

        {/* Streak indicator */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          background: "rgba(249, 115, 22, 0.15)",
          border: "1px solid rgba(249, 115, 22, 0.3)",
          borderRadius: "20px",
          padding: "4px 10px",
          color: "#f97316",
          fontSize: "0.8rem",
          fontWeight: "700"
        }} title={t("Серия дней активности", "Daily active streak")}>
          🔥 {progress.streak} {t("дн.", "days")}
        </div>
      </div>

      {/* XP Bar */}
      <div style={{ marginBottom: "14px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "#94a3b8", marginBottom: "4px" }}>
          <span>{xpInCurrentLevel} / 100 XP</span>
          <span>{progress.points} {t("всего очков", "total points")}</span>
        </div>
        <div style={{ height: "6px", background: "#334155", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${xpInCurrentLevel}%`,
            background: "linear-gradient(90deg, #3b82f6, #8b5cf6)",
            borderRadius: "3px",
            transition: "width 0.4s cubic-bezier(0.4, 0, 0.2, 1)"
          }} />
        </div>
      </div>

      {/* Button to view Achievements */}
      <button 
        onClick={() => setShowModal(true)}
        style={{
          width: "100%",
          background: "rgba(255, 255, 255, 0.05)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          color: "#e2e8f0",
          borderRadius: "8px",
          padding: "8px",
          fontSize: "0.8rem",
          fontWeight: "600",
          cursor: "pointer",
          transition: "all 0.2s"
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"}
        onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)"}
      >
        🏆 {t("Мои Значки & Достижения", "My Badges & Achievements")} ({progress.unlockedAchievements.length} / {ACHIEVEMENTS.length})
      </button>

      {/* Achievements Modal */}
      {showModal && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.75)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 9999,
          backdropFilter: "blur(4px)"
        }} onClick={() => setShowModal(false)}>
          <div style={{
            background: "#0f172a",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            borderRadius: "16px",
            padding: "24px",
            width: "90%",
            maxWidth: "480px",
            maxHeight: "80vh",
            overflowY: "auto",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
            color: "#f8fafc"
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h3 style={{ margin: 0, fontSize: "1.2rem", fontWeight: "700" }}>🏆 {t("Академические Достижения", "Academic Achievements")}</h3>
              <button 
                onClick={() => setShowModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#94a3b8",
                  fontSize: "1.2rem",
                  cursor: "pointer"
                }}
              >✕</button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {ACHIEVEMENTS.map(ach => {
                const unlocked = progress.unlockedAchievements.includes(ach.id);
                return (
                  <div key={ach.id} style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    background: unlocked ? "rgba(255, 255, 255, 0.03)" : "rgba(255, 255, 255, 0.01)",
                    border: unlocked ? "1px solid rgba(139, 92, 246, 0.3)" : "1px solid rgba(255, 255, 255, 0.03)",
                    borderRadius: "12px",
                    padding: "12px",
                    opacity: unlocked ? 1 : 0.45,
                    transition: "all 0.2s"
                  }}>
                    <span style={{
                      fontSize: "2rem",
                      filter: unlocked ? "none" : "grayscale(100%)",
                      transform: unlocked ? "scale(1.1)" : "none"
                    }}>{ach.icon}</span>
                    <div style={{ flex: 1 }}>
                      <h5 style={{ margin: "0 0 2px 0", fontSize: "0.9rem", fontWeight: "600", color: unlocked ? "#f1f5f9" : "#94a3b8" }}>
                        {isEn ? ach.nameEn : ach.name}
                      </h5>
                      <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748b" }}>
                        {isEn ? ach.descEn : ach.desc}
                      </p>
                    </div>
                    {unlocked && (
                      <span style={{ fontSize: "0.7rem", color: "#8b5cf6", fontWeight: "700" }}>✓ Unlocked</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
