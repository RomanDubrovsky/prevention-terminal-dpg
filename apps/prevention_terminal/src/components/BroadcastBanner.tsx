import { useEffect, useState } from "react";
import { t } from "../lib/i18n.ts";

interface Broadcast {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  content: string;
  min_version?: string;
  created_at: string;
}

export default function BroadcastBanner() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [activeBroadcast, setActiveBroadcast] = useState<Broadcast | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Получаем последние оповещения с резервных доменов или API
    const fetchBroadcasts = async () => {
      try {
        // Мы проверяем доступность через основной домен
        const res = await fetch("/api/terminal/broadcasts?limit=5");
        if (res.ok) {
          const data = await res.json();
          const list: Broadcast[] = data.broadcasts || [];
          if (list.length > 0) {
            setBroadcasts(list);
            
            // Находим самое приоритетное непрочитанное сообщение
            const lastDismissedId = localStorage.getItem("last_dismissed_broadcast_id");
            const unread = list.find((b) => b.id !== lastDismissedId);
            if (unread) {
              setActiveBroadcast(unread);
            }
          }
        }
      } catch (e) {
        console.warn("Failed to fetch terminal broadcasts, operating in offline fallback:", e);
      }
    };

    void fetchBroadcasts();
    
    // Периодический опрос раз в 15 минут при наличии сети
    const interval = setInterval(() => {
      void fetchBroadcasts();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  const handleDismiss = () => {
    if (activeBroadcast) {
      localStorage.setItem("last_dismissed_broadcast_id", activeBroadcast.id);
      setIsDismissed(true);
      setActiveBroadcast(null);
    }
  };

  if (!activeBroadcast || isDismissed) return null;

  const isCritical = activeBroadcast.severity === "critical";
  const isWarning = activeBroadcast.severity === "warning";

  // Цветовая гамма в зависимости от приоритета
  let bg = "var(--surface-soft, #f3f4f6)";
  let textColor = "var(--text, #111827)";
  let borderColor = "var(--line, #e5e7eb)";
  let icon = "📢";

  if (isCritical) {
    bg = "rgba(239, 68, 68, 0.1)";
    textColor = "#b91c1c";
    borderColor = "rgba(239, 68, 68, 0.4)";
    icon = "🚨";
  } else if (isWarning) {
    bg = "rgba(245, 158, 11, 0.1)";
    textColor = "#b45309";
    borderColor = "rgba(245, 158, 11, 0.4)";
    icon = "⚠️";
  }

  if (isCritical) {
    // Критическое сообщение блокирует экран (модальное окно)
    return (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          background: "rgba(0, 0, 0, 0.65)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 99999,
          padding: "20px",
          backdropFilter: "blur(4px)",
        }}
      >
        <div
          style={{
            background: "var(--surface, white)",
            border: `2px solid ${textColor}`,
            padding: "24px",
            borderRadius: "16px",
            maxWidth: "500px",
            width: "100%",
            boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "3rem", marginBottom: "12px" }}>{icon}</div>
          <h3 style={{ margin: "0 0 12px 0", color: textColor, fontSize: "1.4rem" }}>
            {activeBroadcast.title}
          </h3>
          <p
            style={{
              margin: "0 0 20px 0",
              fontSize: "0.95rem",
              lineHeight: "1.5",
              color: "var(--text)",
            }}
          >
            {activeBroadcast.content}
          </p>
          <button
            onClick={handleDismiss}
            style={{
              background: textColor,
              color: "white",
              border: "none",
              padding: "10px 24px",
              borderRadius: "8px",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            {t("Подтвердить прочтение", "Acknowledge message")}
          </button>
        </div>
      </div>
    );
  }

  // Обычное информационное оповещение (баннер)
  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: "12px",
        padding: "12px 16px",
        marginBottom: "16px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "12px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "1.2rem" }}>{icon}</span>
        <div>
          <strong style={{ color: textColor, fontSize: "0.9rem", display: "block" }}>
            {activeBroadcast.title}
          </strong>
          <span style={{ fontSize: "0.85rem", color: "var(--text)" }}>
            {activeBroadcast.content}
          </span>
        </div>
      </div>
      <button
        onClick={handleDismiss}
        style={{
          background: "transparent",
          border: "none",
          color: "var(--muted)",
          cursor: "pointer",
          fontSize: "1.2rem",
          padding: "4px 8px",
        }}
        aria-label="Close"
      >
        ×
      </button>
    </div>
  );
}
