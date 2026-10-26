import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  type CloudRecording,
  type WebinarItem,
  findRecordingById,
  calculateCleanDurationMinutes,
} from "../../lib/webinars_store.ts";
import { t } from "../../lib/i18n.ts";

interface ProtectedRecordingPlayerProps {
  recordingId: string;
  initialTicket?: string;
  onClose?: () => void;
  onOpenPsychologistWorkspace?: () => void;
}

function formatSeconds(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.floor(totalSec % 60);
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return `${mm}:${ss}`;
}

export const ProtectedRecordingPlayer: React.FC<ProtectedRecordingPlayerProps> = ({
  recordingId,
  initialTicket,
  onClose,
  onOpenPsychologistWorkspace,
}) => {
  const found = useMemo(() => findRecordingById(recordingId), [recordingId]);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Authorization / Ticket State
  const [ticketInput, setTicketInput] = useState<string>(initialTicket || "");
  const [unlockedEmail, setUnlockedEmail] = useState<string>(() => {
    try {
      return localStorage.getItem(`rec_auth_${recordingId}`) || "";
    } catch {
      return "";
    }
  });

  const [activeTab, setActiveTab] = useState<"video" | "summary" | "materials">("video");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Watermark coordinates (smooth floating)
  const [watermarkPos, setWatermarkPos] = useState<{ top: number; left: number }>({ top: 15, left: 20 });

  const isPaid = Boolean(found?.recording.monetization?.isPaid);
  const isUnlocked = !isPaid || Boolean(unlockedEmail) || Boolean(initialTicket);

  // Periodic watermark movement
  useEffect(() => {
    if (!isUnlocked) return;
    const interval = setInterval(() => {
      // Random percentages within 10% - 75%
      const top = Math.floor(Math.random() * 65) + 10;
      const left = Math.floor(Math.random() * 60) + 10;
      setWatermarkPos({ top, left });
    }, 12000);

    return () => clearInterval(interval);
  }, [isUnlocked]);

  // Trim and cut logic
  const trim = found?.recording.trimSettings;
  const cutIntervals = trim?.cutIntervals || [];
  const trimStart = trim?.trimStartSeconds || 0;
  const totalSeconds = (found?.recording.durationMinutes || 90) * 60;
  const trimEnd = trim?.trimEndSeconds && trim.trimEndSeconds > 0 ? trim.trimEndSeconds : totalSeconds;

  // Video time tracking
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isUnlocked) return;

    // Set initial start time if trimmed
    if (trimStart > 0 && video.currentTime < trimStart) {
      video.currentTime = trimStart;
    }

    const handleTimeUpdate = () => {
      const cur = video.currentTime;

      // 1. Skip start
      if (cur < trimStart) {
        video.currentTime = trimStart;
        return;
      }

      // 2. Stop at trimEnd
      if (cur >= trimEnd) {
        video.pause();
        video.currentTime = trimEnd;
        showToast("✓ Чистовая запись подошла к концу");
        return;
      }

      // 3. Skip cut intervals (coffee breaks, silence)
      for (const cut of cutIntervals) {
        if (cur >= cut.startSeconds && cur < cut.endSeconds) {
          video.currentTime = cut.endSeconds;
          showToast(`☕ ${cut.label || "Перерыв"} автоматически пропущен`);
          break;
        }
      }
    };

    video.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      video.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [trimStart, trimEnd, cutIntervals, isUnlocked]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const handleUnlockWithEmailOrTicket = () => {
    const trimmed = ticketInput.trim();
    if (!trimmed) {
      alert("Пожалуйста, введите ваш email или код билета, указанный при покупке.");
      return;
    }
    setUnlockedEmail(trimmed);
    try {
      localStorage.setItem(`rec_auth_${recordingId}`, trimmed);
    } catch {}
    showToast("✓ Доступ к защищенной записи успешно открыт!");
  };

  if (!found) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#64748b", fontFamily: "sans-serif" }}>
        <h3>Запись не найдена или срок хранения истек</h3>
        {onClose && (
          <button type="button" onClick={onClose} style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}>
            Вернуться
          </button>
        )}
      </div>
    );
  }

  const { webinar, recording } = found;
  const monetization = recording.monetization;
  const cleanDuration = calculateCleanDurationMinutes(recording.durationMinutes, recording.trimSettings);
  const viewerEmail = unlockedEmail || (initialTicket ? `Билет: ${initialTicket}` : "Гостевой просмотр");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#090d16",
        color: "#f8fafc",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* Top Navbar */}
      <div
        style={{
          background: "#0f172a",
          borderBottom: "1px solid #1e293b",
          padding: "12px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "1.3rem" }}>🛡️</span>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#fff" }}>
                {recording.webinarTitle}
              </h2>
              {recording.trimSettings && (
                <span
                  style={{
                    fontSize: "0.7rem",
                    background: "#065f46",
                    color: "#a7f3d0",
                    padding: "2px 8px",
                    borderRadius: "4px",
                    fontWeight: 600,
                  }}
                >
                  ✂️ Чистовая версия ({cleanDuration} мин)
                </span>
              )}
            </div>
            <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>
              Спикер: {webinar.speakerName} • Записано: {recording.recordedAt}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          {isUnlocked && monetization?.singleSessionEnforced && (
            <span style={{ fontSize: "0.75rem", color: "#34d399", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              ● 1 защищенный поток (без дублей)
            </span>
          )}

          <button
            type="button"
            onClick={() => {
              if (onOpenPsychologistWorkspace) {
                onOpenPsychologistWorkspace();
              } else {
                window.location.href = "https://ida-psy.ru";
              }
            }}
            style={{
              background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
              color: "#ffffff",
              border: "1px solid #6366f1",
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)",
            }}
          >
            <span>💼</span> Кабинет психолога
          </button>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "#1e293b",
                color: "#e2e8f0",
                border: "1px solid #334155",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ✕ Закрыть
            </button>
          )}
        </div>
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: "1200px", width: "100%", margin: "0 auto", padding: "20px" }}>
        {/* Toast alert */}
        {toastMessage && (
          <div
            style={{
              background: "#1e1b4b",
              border: "1px solid #4f46e5",
              color: "#c7d2fe",
              padding: "10px 18px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              marginBottom: "16px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              animation: "fadeIn 0.2s ease-in-out",
            }}
          >
            <span>✨</span> {toastMessage}
          </div>
        )}

        {!isUnlocked ? (
          /* PAYWALL GATE */
          <div
            style={{
              background: "#0f172a",
              border: "1px solid #1e293b",
              borderRadius: "16px",
              padding: "40px",
              textAlign: "center",
              margin: "auto 0",
              boxShadow: "0 20px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ fontSize: "3rem", marginBottom: "12px" }}>🔒</div>
            <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "#fff", margin: "0 0 10px 0" }}>
              {monetization?.customOfferTitle || recording.webinarTitle}
            </h2>
            <p style={{ maxWidth: "600px", margin: "0 auto 24px auto", color: "#94a3b8", fontSize: "0.95rem", lineHeight: 1.6 }}>
              {webinar.description || "Полная запись эфира с вырезанными паузами и ожиданиями, методические материалы и конспект ключевых тезисов."}
            </p>

            {/* Clean feature badges */}
            <div style={{ display: "flex", justifyContent: "center", gap: "12px", flexWrap: "wrap", marginBottom: "28px" }}>
              <span style={{ background: "#1e293b", padding: "6px 14px", borderRadius: "20px", fontSize: "0.85rem", color: "#38bdf8" }}>
                ⏱️ Хронометраж: {cleanDuration} мин (чистый контент)
              </span>
              <span style={{ background: "#1e293b", padding: "6px 14px", borderRadius: "20px", fontSize: "0.85rem", color: "#a7f3d0" }}>
                📝 ИИ-конспект и глоссарий в комплекте
              </span>
              <span style={{ background: "#1e293b", padding: "6px 14px", borderRadius: "20px", fontSize: "0.85rem", color: "#fbcfe8" }}>
                🛡️ Лицензионный доступ без рекламы
              </span>
            </div>

            {/* Buy CTA */}
            <div style={{ background: "#1e293b", borderRadius: "14px", padding: "24px", maxWidth: "460px", margin: "0 auto 24px auto", border: "1px solid #334155" }}>
              <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "4px" }}>Стоимость доступа:</div>
              <div style={{ fontSize: "2rem", fontWeight: 800, color: "#fff", marginBottom: "16px" }}>
                {(monetization?.priceRub || 1490).toLocaleString("ru-RU")} ₽
              </div>

              {monetization?.paymentUrl ? (
                <a
                  href={monetization.paymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "block",
                    background: "linear-gradient(90deg, #10b981 0%, #059669 100%)",
                    color: "#fff",
                    textDecoration: "none",
                    padding: "14px 24px",
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    boxShadow: "0 4px 14px rgba(16, 185, 129, 0.3)",
                  }}
                >
                  💳 Оплатить доступ к записи
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => alert("Ссылка на оплату еще настраивается автором мероприятия.")}
                  style={{
                    width: "100%",
                    background: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    padding: "14px 24px",
                    borderRadius: "10px",
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    cursor: "pointer",
                  }}
                >
                  💳 Оплатить доступ к записи
                </button>
              )}
            </div>

            {/* Already Purchased / Ticket Form */}
            <div style={{ maxWidth: "420px", margin: "0 auto" }}>
              <div style={{ fontSize: "0.85rem", color: "#94a3b8", marginBottom: "8px" }}>
                Уже приобрели доступ? Введите email или код билета:
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  value={ticketInput}
                  onChange={(e) => setTicketInput(e.target.value)}
                  placeholder="name@example.com или tk_..."
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "8px",
                    border: "1px solid #334155",
                    background: "#0b0f19",
                    color: "#fff",
                    fontSize: "0.9rem",
                  }}
                />
                <button
                  type="button"
                  onClick={handleUnlockWithEmailOrTicket}
                  style={{
                    background: "#4f46e5",
                    color: "#fff",
                    border: "none",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    cursor: "pointer",
                  }}
                >
                  Войти
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* PROTECTED VIDEO PLAYER */
          <div>
            {/* Player Container */}
            <div
              style={{
                background: "#000",
                borderRadius: "16px",
                overflow: "hidden",
                boxShadow: "0 20px 40px rgba(0,0,0,0.6)",
                position: "relative",
                aspectRatio: "16/9",
                maxHeight: "68vh",
                margin: "0 auto 16px auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <video
                ref={videoRef}
                src={recording.videoUrl}
                controls
                playsInline
                controlsList={monetization?.isPaid || monetization?.watermarkEnabled ? "nodownload" : undefined}
                disablePictureInPicture={Boolean(monetization?.isPaid || monetization?.watermarkEnabled)}
                onContextMenu={(e) => {
                  if (monetization?.isPaid || monetization?.watermarkEnabled) {
                    e.preventDefault();
                  }
                }}
                style={{ width: "100%", height: "100%", objectFit: "contain" }}
              />

              {/* Dynamic Anti-Piracy Watermark */}
              {monetization?.watermarkEnabled && (
                <div
                  style={{
                    position: "absolute",
                    top: `${watermarkPos.top}%`,
                    left: `${watermarkPos.left}%`,
                    pointerEvents: "none",
                    opacity: 0.35,
                    color: "#ffffff",
                    fontSize: "0.78rem",
                    fontFamily: "monospace",
                    background: "rgba(0,0,0,0.4)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    transition: "top 2s ease-in-out, left 2s ease-in-out",
                    userSelect: "none",
                    zIndex: 10,
                  }}
                >
                  🛡️ {viewerEmail} • Лицензия IDA
                </div>
              )}
            </div>

            {/* Navigation Tabs below video */}
            <div style={{ display: "flex", borderBottom: "1px solid #1e293b", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setActiveTab("video")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "video" ? "3px solid #6366f1" : "3px solid transparent",
                  padding: "10px 18px",
                  color: activeTab === "video" ? "#fff" : "#94a3b8",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                🎬 О записи и хронометраж
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("summary")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "summary" ? "3px solid #6366f1" : "3px solid transparent",
                  padding: "10px 18px",
                  color: activeTab === "summary" ? "#fff" : "#94a3b8",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                📝 ИИ-Конспект сессии
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("materials")}
                style={{
                  background: "transparent",
                  border: "none",
                  borderBottom: activeTab === "materials" ? "3px solid #6366f1" : "3px solid transparent",
                  padding: "10px 18px",
                  color: activeTab === "materials" ? "#fff" : "#94a3b8",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                📚 Материалы ({webinar.materials.length})
              </button>
            </div>

            {/* Tab 1: Video details */}
            {activeTab === "video" && (
              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "18px 22px", border: "1px solid #1e293b" }}>
                <h3 style={{ margin: "0 0 8px 0", fontSize: "1.1rem", fontWeight: 700, color: "#fff" }}>
                  {recording.webinarTitle}
                </h3>
                <p style={{ margin: "0 0 14px 0", color: "#94a3b8", fontSize: "0.9rem", lineHeight: 1.5 }}>
                  {webinar.description}
                </p>

                {recording.trimSettings && (
                  <div style={{ background: "#1e293b", borderRadius: "8px", padding: "10px 14px", fontSize: "0.82rem", color: "#cbd5e1" }}>
                    ✨ <strong>Умная обрезка активна:</strong> пропущено {recording.durationMinutes - cleanDuration} минут пауз и ожиданий. Видео воспроизводится в чистом режиме.
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: AI Summary */}
            {activeTab === "summary" && recording.aiSummary && (
              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "20px 24px", border: "1px solid #1e293b" }}>
                <h4 style={{ margin: "0 0 10px 0", color: "#818cf8", fontSize: "1rem", fontWeight: 700 }}>
                  Обзор сессии
                </h4>
                <p style={{ margin: "0 0 18px 0", color: "#e2e8f0", fontSize: "0.9rem", lineHeight: 1.6 }}>
                  {recording.aiSummary.overview}
                </p>

                <h4 style={{ margin: "0 0 8px 0", color: "#818cf8", fontSize: "0.95rem", fontWeight: 700 }}>
                  Ключевые тезисы
                </h4>
                <ul style={{ margin: "0 0 18px 0", paddingLeft: "20px", color: "#cbd5e1", fontSize: "0.88rem", lineHeight: 1.6 }}>
                  {recording.aiSummary.keyPoints.map((pt, i) => (
                    <li key={i} style={{ marginBottom: "6px" }}>{pt}</li>
                  ))}
                </ul>

                <h4 style={{ margin: "0 0 8px 0", color: "#818cf8", fontSize: "0.95rem", fontWeight: 700 }}>
                  Практические действия и рекомендации
                </h4>
                <ul style={{ margin: 0, paddingLeft: "20px", color: "#cbd5e1", fontSize: "0.88rem", lineHeight: 1.6 }}>
                  {recording.aiSummary.actionItems.map((act, i) => (
                    <li key={i} style={{ marginBottom: "6px" }}>{act}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Tab 3: Materials */}
            {activeTab === "materials" && (
              <div style={{ background: "#0f172a", borderRadius: "12px", padding: "18px 22px", border: "1px solid #1e293b" }}>
                {webinar.materials.length === 0 ? (
                  <p style={{ color: "#94a3b8", fontSize: "0.9rem" }}>К этой записи пока нет прикрепленных файлов.</p>
                ) : (
                  <div style={{ display: "grid", gap: "10px" }}>
                    {webinar.materials.map((mat) => (
                      <div
                        key={mat.id}
                        style={{
                          background: "#1e293b",
                          padding: "12px 16px",
                          borderRadius: "8px",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.88rem",
                        }}
                      >
                        <div>
                          <strong style={{ color: "#fff" }}>📄 {mat.title}</strong>
                          <div style={{ fontSize: "0.78rem", color: "#94a3b8" }}>{mat.fileName} • {mat.fileSizeMb} МБ</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => alert(`Загрузка файла: ${mat.fileName}`)}
                          style={{
                            background: "#4f46e5",
                            color: "#fff",
                            border: "none",
                            padding: "6px 14px",
                            borderRadius: "6px",
                            fontWeight: 600,
                            fontSize: "0.82rem",
                            cursor: "pointer",
                          }}
                        >
                          Скачать
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Psychologist Workspace Banner */}
        {Boolean(onOpenPsychologistWorkspace) && (
          <div
          style={{
            marginTop: "32px",
            background: "linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(30, 27, 75, 0.4) 100%)",
            border: "1px solid rgba(99, 102, 241, 0.3)",
            borderRadius: "16px",
            padding: "24px 28px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "20px",
          }}
        >
          <div style={{ maxWidth: "680px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
              <span style={{ fontSize: "1.4rem" }}>💼</span>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#fff" }}>
                Рабочий кабинет психолога IDA
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: "0.88rem", color: "#94a3b8", lineHeight: 1.5 }}>
              Применяйте материалы вебинара на практике: ведите клиентов, заполняйте протоколы встреч,
              используйте доказательные опросники и получайте помощь ИИ-ассистента в клинической работе.
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (onOpenPsychologistWorkspace) {
                onOpenPsychologistWorkspace();
              } else {
                window.location.href = "https://ida-psy.ru";
              }
            }}
            style={{
              background: "linear-gradient(135deg, #4f46e5 0%, #3730a3 100%)",
              color: "#ffffff",
              border: "none",
              padding: "12px 24px",
              borderRadius: "10px",
              fontSize: "0.95rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              boxShadow: "0 4px 16px rgba(79, 70, 229, 0.4)",
            }}
          >
            <span>💼 Открыть рабочий кабинет психолога</span>
          </button>
        </div>
        )}
      </div>
    </div>
  );
};

export default ProtectedRecordingPlayer;
