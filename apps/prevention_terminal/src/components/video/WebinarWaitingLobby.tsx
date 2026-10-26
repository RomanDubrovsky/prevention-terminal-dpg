import React, { useState, useMemo } from "react";
import { findWebinarByRoomName, generateRecordingShareLink, loadWebinars, saveWebinars } from "../../lib/webinars_store.ts";
import { loadCourseStudents, saveCourseStudents, generateAccessCode } from "../../lib/course_students_store.ts";

interface WebinarWaitingLobbyProps {
  roomName: string;
  title?: string;
  scheduledTime?: string;
  speakerName?: string;
  description?: string;
  role?: "guest" | "speaker" | "cohost" | "listener" | "student" | "author" | string;
  onJoinRoom: (userName?: string) => void;
  onSwitchRole?: (newRole: any) => void;
  onBack?: () => void;
  onOpenPsychologistWorkspace?: () => void;
}

export const WebinarWaitingLobby: React.FC<WebinarWaitingLobbyProps> = ({
  roomName,
  title: initialTitle,
  scheduledTime,
  speakerName,
  description,
  role = "listener",
  onJoinRoom,
  onBack,
  onOpenPsychologistWorkspace,
}) => {
  const isSpeaker = role === "speaker" || role === "cohost" || role === "author";
  const isStudent = role === "student";

  // Check if room belongs to a finished webinar with an available recording
  const matchedWebinar = useMemo(() => findWebinarByRoomName(roomName), [roomName]);
  const hasRecording = Boolean(matchedWebinar?.recording && matchedWebinar.recording.status === "ready");
  const isWebinarFinished = matchedWebinar?.status === "finished" && hasRecording;

  // Display title without fake demo medical texts
  const displayTitle = initialTitle || matchedWebinar?.title || (isStudent ? "Учебное занятие курса" : "Прямой эфир");

  // Initial registration tariff from URL (?reg=paid or ?reg=free)
  const [regTariff, setRegTariff] = useState<"free" | "paid">(() => {
    try {
      const sp = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
      if (sp?.get("reg") === "paid" || sp?.get("tariff") === "paid") return "paid";
    } catch {}
    return "free";
  });

  // User display name & email state (stored in localStorage)
  const [userName, setUserName] = useState<string>(() => {
    try {
      const urlName = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("name") : null;
      if (urlName) return urlName;
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("ida_user_display_name") : null;
      if (saved) return saved;
    } catch {
      // ignore
    }
    return isSpeaker ? "Ведущий" : isStudent ? "Студент" : "";
  });

  const [userEmail, setUserEmail] = useState<string>(() => {
    try {
      const urlEmail = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("email") : null;
      if (urlEmail) return urlEmail;
      const saved = typeof localStorage !== "undefined" ? localStorage.getItem("ida_user_email") : null;
      if (saved) return saved;
    } catch {}
    return "";
  });

  const [registeredNotice, setRegisteredNotice] = useState<string | null>(null);
  const [soundChecked, setSoundChecked] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const hasPaidPrice = Boolean(
    (matchedWebinar?.priceRub && matchedWebinar.priceRub > 0) ||
    (matchedWebinar?.recording?.monetization?.isPaid && (matchedWebinar.recording.monetization.priceRub || 0) > 0)
  );
  const isPaidWebinar = hasPaidPrice;

  const paidPriceRub =
    matchedWebinar?.recording?.monetization?.priceRub ||
    matchedWebinar?.priceRub ||
    0;
  const paymentUrl =
    matchedWebinar?.recording?.monetization?.paymentUrl ||
    matchedWebinar?.paymentUrl ||
    "";

  // Soft Web Audio chime to test speakers/headphones
  const playWebAudioChime = (freq = 587.33, duration = 0.5) => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + duration);
      setSoundChecked(true);
    } catch (e) {
      console.warn("Audio test error:", e);
    }
  };

  const registerListenerInStore = (finalName: string, finalEmail: string, tariff: "free" | "paid") => {
    if (isSpeaker) return;
    try {
      const students = loadCourseStudents();
      const wid = matchedWebinar?.id || "web-1";
      const cleanEmail = finalEmail.trim().toLowerCase();
      const existingIdx = students.findIndex(
        (s) =>
          (cleanEmail && s.email && s.email.toLowerCase() === cleanEmail) ||
          s.fullName.toLowerCase() === finalName.toLowerCase()
      );

      const pType = tariff === "paid" ? ("paid_cert" as const) : ("free_reg" as const);
      if (existingIdx !== -1) {
        const ex = students[existingIdx];
        const nextWebIds = Array.from(new Set([...(ex.webinarIds || []), wid]));
        const nextPaidIds =
          tariff === "paid"
            ? Array.from(new Set([...(ex.paidWebinarIds || []), wid]))
            : ex.paidWebinarIds || [];
        students[existingIdx] = {
          ...ex,
          fullName: finalName || ex.fullName,
          email: finalEmail.trim() || ex.email,
          participationType: tariff === "paid" ? "paid_cert" : ex.participationType || "free_reg",
          webinarIds: nextWebIds,
          paidWebinarIds: nextPaidIds,
        };
      } else {
        students.unshift({
          id: `stu-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          fullName: finalName,
          email: finalEmail.trim() || undefined,
          courseIds: [],
          webinarIds: [wid],
          paidWebinarIds: tariff === "paid" ? [wid] : [],
          participationType: pType,
          status: "active",
          registeredAt: new Date().toISOString().slice(0, 10),
          accessCode: generateAccessCode(),
          notes:
            tariff === "paid"
              ? `Платник вебинара (Запись + Сертификат): ${displayTitle}`
              : `Бесплатная регистрация на вебинар: ${displayTitle}`,
        });

        // Also increment registeredCount on the webinar
        if (matchedWebinar) {
          const allW = loadWebinars();
          const updatedW = allW.map((w) =>
            w.id === matchedWebinar.id ? { ...w, registeredCount: (w.registeredCount || 0) + 1 } : w
          );
          saveWebinars(updatedW);
        }
      }
      saveCourseStudents(students);
      setRegisteredNotice(
        tariff === "paid"
          ? "✓ Регистрация сохранена (категория: Запись + Сертификат)"
          : "✓ Вход выполнен"
      );
    } catch (err) {
      console.warn("Could not save webinar registration:", err);
    }
  };

  const handleJoin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const finalName = userName.trim() || (isSpeaker ? "Ведущий" : isStudent ? "Студент" : "Слушатель");
    try {
      localStorage.setItem("ida_user_display_name", finalName);
      if (userEmail.trim()) {
        localStorage.setItem("ida_user_email", userEmail.trim());
      }
    } catch {
      // ignore
    }

    if (!isSpeaker && !isStudent) {
      const actualTariff = isPaidWebinar ? regTariff : "free";
      registerListenerInStore(finalName, userEmail, actualTariff);
      if (actualTariff === "paid" && paymentUrl) {
        window.open(paymentUrl, "_blank", "noopener,noreferrer");
      }
    }
    onJoinRoom(finalName);
  };

  const handleCopyLink = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard?.writeText(window.location.href);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const formattedScheduledTime = useMemo(() => {
    if (!scheduledTime) return null;
    try {
      const d = new Date(scheduledTime);
      if (isNaN(d.getTime())) return null;
      return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "long" });
    } catch {
      return null;
    }
  }, [scheduledTime]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99990,
        backgroundColor: "#f8fafc",
        backgroundImage: "radial-gradient(circle at 50% 15%, rgba(14, 165, 233, 0.08) 0%, transparent 65%)",
        color: "#0f172a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "20px",
          padding: "32px 28px",
          boxShadow: "0 20px 45px -10px rgba(15, 23, 42, 0.12), 0 8px 16px -6px rgba(15, 23, 42, 0.04)",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          position: "relative",
        }}
      >
        {/* Top Header Row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: isWebinarFinished ? "#0284c7" : "#10b981",
                boxShadow: isWebinarFinished ? "0 0 8px rgba(2, 132, 199, 0.6)" : "0 0 8px rgba(16, 185, 129, 0.6)",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 700,
                color: isWebinarFinished ? "#0369a1" : "#059669",
                letterSpacing: "0.03em",
                textTransform: "uppercase",
              }}
            >
              {isWebinarFinished ? "Запись эфира доступна" : "Прямой эфир готов"}
            </span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              onClick={handleCopyLink}
              title="Скопировать ссылку на этот эфир"
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                color: isCopied ? "#059669" : "#475569",
                padding: "4px 10px",
                borderRadius: "8px",
                fontSize: "0.74rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {isCopied ? "✓ Скопировано" : "📋 Ссылка"}
            </button>
            {onBack && (
              <button
                type="button"
                onClick={onBack}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#64748b",
                  padding: "4px 8px",
                  fontSize: "1.1rem",
                  lineHeight: 1,
                  cursor: "pointer",
                  borderRadius: "6px",
                }}
                title="Закрыть и вернуться назад"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Title and Info */}
        <div style={{ textAlign: "center", display: "flex", flexDirection: "column", gap: "8px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: isSpeaker
                ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                : isStudent
                ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                : "linear-gradient(135deg, #059669 0%, #047857 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.6rem",
              margin: "0 auto 4px",
              boxShadow: "0 8px 16px rgba(15, 23, 42, 0.15)",
              color: "#ffffff",
            }}
          >
            {isSpeaker ? "🎙️" : isStudent ? "🎓" : "👥"}
          </div>

          <h1
            style={{
              fontSize: "1.35rem",
              fontWeight: 800,
              color: "#0f172a",
              margin: 0,
              lineHeight: 1.3,
            }}
          >
            {displayTitle}
          </h1>

          {speakerName && (
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
              Ведущий: <span style={{ color: "#1e293b", fontWeight: 600 }}>{speakerName}</span>
            </p>
          )}

          {formattedScheduledTime && (
            <div style={{ fontSize: "0.82rem", color: "#4f46e5", fontWeight: 600, marginTop: "2px" }}>
              🗓️ Начало: {formattedScheduledTime}
            </div>
          )}

          {description && (
            <p
              style={{
                margin: "4px 0 0 0",
                fontSize: "0.84rem",
                color: "#64748b",
                lineHeight: 1.45,
              }}
            >
              {description}
            </p>
          )}
        </div>

        {/* Role Badge */}
        <div
          style={{
            background: isSpeaker
              ? "rgba(99, 102, 241, 0.08)"
              : isStudent
              ? "rgba(2, 132, 199, 0.08)"
              : "rgba(16, 185, 129, 0.08)",
            border: isSpeaker
              ? "1px solid rgba(99, 102, 241, 0.25)"
              : isStudent
              ? "1px solid rgba(2, 132, 199, 0.25)"
              : "1px solid rgba(16, 185, 129, 0.25)",
            borderRadius: "12px",
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            fontSize: "0.82rem",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>{isSpeaker ? "🎙️" : isStudent ? "🎓" : "👥"}</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontWeight: 700, color: isSpeaker ? "#4338ca" : isStudent ? "#0369a1" : "#047857" }}>
              {isSpeaker ? "Ведущий эфира" : isStudent ? "Студент курса" : "Слушатель"}
            </span>
            <div style={{ fontSize: "0.74rem", color: "#64748b", marginTop: "1px" }}>
              {isSpeaker
                ? "Управление трансляцией, микрофон и показ экрана"
                : isStudent
                ? "Микрофон, камера и показ работ на занятии"
                : "Просмотр эфира, вопросы в чат и микрофон по запросу"}
            </div>
          </div>
        </div>

        {/* Finished Webinar / Recording Available Card */}
        {isWebinarFinished && matchedWebinar?.recording && (
          <div
            style={{
              background: "linear-gradient(135deg, rgba(224, 242, 254, 0.8) 0%, rgba(240, 249, 255, 0.9) 100%)",
              border: "1px solid #bae6fd",
              borderRadius: "14px",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontSize: "1.3rem" }}>🎬</span>
              <div>
                <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "#0369a1" }}>
                  Прямой эфир завершён
                </div>
                <div style={{ fontSize: "0.78rem", color: "#0284c7" }}>
                  Вам доступна чистовая видеозапись и материалы занятия
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const recLink = generateRecordingShareLink(matchedWebinar.recording!.id);
                window.location.href = recLink;
              }}
              style={{
                width: "100%",
                background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
                color: "#ffffff",
                border: "none",
                borderRadius: "10px",
                padding: "12px 16px",
                fontSize: "0.92rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow: "0 4px 14px rgba(2, 132, 199, 0.3)",
              }}
            >
              ▶️ Смотреть запись ({matchedWebinar.recording.durationMinutes} мин)
            </button>
          </div>
        )}

        {/* User Name Input, Tariff Selector & Join Form */}
        <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {/* Tariff Selector: ONLY IF WEBINAR AUTHOR CONFIGURED A PAID PRICE */}
          {!isSpeaker && !isStudent && isPaidWebinar && (
            <div>
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#64748b", marginBottom: "6px" }}>
                Формат участия (категория регистрации):
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                <button
                  type="button"
                  onClick={() => setRegTariff("free")}
                  style={{
                    padding: "9px 10px",
                    borderRadius: "10px",
                    border: regTariff === "free" ? "2px solid #10b981" : "1px solid #cbd5e1",
                    background: regTariff === "free" ? "#ecfdf5" : "#ffffff",
                    color: "#0f172a",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: regTariff === "free" ? "#047857" : "#334155" }}>
                    🆓 Бесплатно на эфир
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "2px" }}>
                    Участие в прямом эфире и чат
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setRegTariff("paid")}
                  style={{
                    padding: "9px 10px",
                    borderRadius: "10px",
                    border: regTariff === "paid" ? "2px solid #f59e0b" : "1px solid #cbd5e1",
                    background: regTariff === "paid" ? "#fffbeb" : "#ffffff",
                    color: "#0f172a",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                >
                  <div style={{ fontSize: "0.8rem", fontWeight: 700, color: regTariff === "paid" ? "#b45309" : "#334155" }}>
                    💳 Запись + Сертификат ({paidPriceRub} ₽)
                  </div>
                  <div style={{ fontSize: "0.68rem", color: "#64748b", marginTop: "2px" }}>
                    Категория «Платники» (запись на почту)
                  </div>
                </button>
              </div>
            </div>
          )}

          <div>
            <label
              htmlFor="lobby-name-input"
              style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "5px" }}
            >
              {isPaidWebinar && regTariff === "paid"
                ? "Ваше ФИО (для эфира и именного сертификата):"
                : "Ваше имя (для отображения в чате эфира):"}
            </label>
            <input
              id="lobby-name-input"
              type="text"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              placeholder={isPaidWebinar && regTariff === "paid" ? "Например: Смирнова Елена Викторовна" : "Например: Елена С."}
              maxLength={60}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "#f8fafc",
                border: "1px solid #cbd5e1",
                borderRadius: "10px",
                padding: "10px 14px",
                color: "#0f172a",
                fontSize: "0.9rem",
                outline: "none",
              }}
            />
          </div>

          {/* Email field: ONLY for paid webinars OR when tariff is paid */}
          {!isSpeaker && isPaidWebinar && (
            <div>
              <label
                htmlFor="lobby-email-input"
                style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#475569", marginBottom: "5px" }}
              >
                Ваш Email (на него придёт сертификат и ссылка на запись):
              </label>
              <input
                id="lobby-email-input"
                type="email"
                value={userEmail}
                onChange={(e) => setUserEmail(e.target.value)}
                placeholder="name@example.ru"
                maxLength={80}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "#f8fafc",
                  border: "1px solid #cbd5e1",
                  borderRadius: "10px",
                  padding: "10px 14px",
                  color: "#0f172a",
                  fontSize: "0.9rem",
                  outline: "none",
                }}
              />
            </div>
          )}

          {registeredNotice && (
            <div
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                color: "#047857",
                fontSize: "0.78rem",
                fontWeight: 600,
              }}
            >
              {registeredNotice}
            </div>
          )}

          <button
            type="submit"
            style={{
              width: "100%",
              background: isSpeaker
                ? "linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)"
                : isStudent
                ? "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)"
                : isPaidWebinar && regTariff === "paid"
                ? "linear-gradient(135deg, #d97706 0%, #b45309 100%)"
                : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              color: "#ffffff",
              border: "none",
              borderRadius: "12px",
              padding: "14px 20px",
              fontSize: "0.96rem",
              fontWeight: 800,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              boxShadow: isSpeaker
                ? "0 4px 16px rgba(99, 102, 241, 0.3)"
                : isStudent
                ? "0 4px 16px rgba(2, 132, 199, 0.3)"
                : isPaidWebinar && regTariff === "paid"
                ? "0 4px 16px rgba(217, 119, 6, 0.3)"
                : "0 4px 16px rgba(16, 185, 129, 0.3)",
              marginTop: "4px",
              transition: "transform 0.1s ease",
            }}
          >
            <span>
              {isSpeaker
                ? "🚀 Запустить эфир"
                : isStudent
                ? "🎓 Присоединиться к занятию"
                : isPaidWebinar && regTariff === "paid"
                ? "💳 Зарегистрироваться (Запись + Сертификат) и войти"
                : "Войти в прямой эфир →"}
            </span>
          </button>
        </form>

        {/* Bottom Audio Test */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <button
            type="button"
            onClick={() => playWebAudioChime(659.25, 0.5)}
            style={{
              background: "transparent",
              border: "none",
              color: soundChecked ? "#059669" : "#64748b",
              fontSize: "0.76rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
            }}
          >
            <span>{soundChecked ? "✅ Звук проверен" : "🔊 Проверить звук динамика"}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default WebinarWaitingLobby;
