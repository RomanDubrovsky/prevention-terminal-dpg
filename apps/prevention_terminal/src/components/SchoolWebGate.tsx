import { useState, useEffect } from "react";
import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";

interface SchoolWebGateProps {
  onAuthorized: () => void;
}

export default function SchoolWebGate({ onAuthorized }: SchoolWebGateProps) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp" | "loading">("email");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const isRu = getTerminalEdition() === "ru";
  const landingUrl = isRu ? "https://prevention.school/ru/workspace/" : "https://prevention.school/ru/workspace/";

  useEffect(() => {
    const token = localStorage.getItem("platform_access_token");
    if (token) onAuthorized();
  }, [onAuthorized]);

  const SUPABASE_PSY_URL = "https://ecppmcsceglmqsogijws.supabase.co";
  const SUPABASE_PSY_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjcHBtY3NjZWdsbXFzb2dpandzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzExMzc0NjMsImV4cCI6MjA4NjcxMzQ2M30.ZFUtTkV3fw10CICsXG1LMvLxvu4E9W5q_yWzpeKOOlE";

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (honeypot.trim().length > 0) {
      setMessage(t("Код подтверждения отправлен на вашу почту", "Verification code sent to your email"));
      setStep("otp");
      return;
    }

    setStep("loading");
    setError(null);
    setMessage(null);
    try {
      let res = await fetch("https://auth.prevention.school/auth/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, app_id: "school_web_terminal", website: honeypot }),
      }).catch(() => null);

      if (res === null) {
        res = await fetch(`${SUPABASE_PSY_URL}/auth/v1/otp`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_PSY_ANON_KEY,
          },
          body: JSON.stringify({ email }),
        });
      }

      if (!res.ok) {
        if (res.status === 429) {
          throw new Error(t("Слишком много запросов. Пожалуйста, подождите 60 секунд перед повторной отправкой кода.", "Too many requests. Please wait 60 seconds before requesting another code."));
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.msg || data.message || data.error_description || t("Не удалось отправить код подтверждения", "Failed to send verification code"));
      }
      setMessage(t("Код подтверждения отправлен на вашу почту", "Verification code sent to your email"));
      setStep("otp");
    } catch (err: any) {
      setError(err.message || String(err));
      setStep("email");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOtp = otp.trim().replace(/\D/g, "");
    if (!cleanOtp) return;
    setStep("loading");
    setError(null);
    try {
      const res = await fetch("https://auth.prevention.school/auth/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: cleanOtp, app_id: "school_web_terminal" }),
      }).catch(() => null);

      if (res) {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.access_token) {
          localStorage.setItem("platform_access_token", data.access_token);
          localStorage.setItem("platform_user_id", data.user_id || "");
          localStorage.setItem("platform_email", email.trim().toLowerCase());
          onAuthorized();
          return;
        } else if (!res.ok && data.message) {
          throw new Error(data.message);
        }
      }

      let sbRes = await fetch(`${SUPABASE_PSY_URL}/auth/v1/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_PSY_ANON_KEY,
        },
        body: JSON.stringify({ type: "email", email: email.trim().toLowerCase(), token: cleanOtp }),
      });
      if (!sbRes.ok) {
        sbRes = await fetch(`${SUPABASE_PSY_URL}/auth/v1/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_PSY_ANON_KEY,
          },
          body: JSON.stringify({ type: "signup", email: email.trim().toLowerCase(), token: cleanOtp }),
        });
      }
      if (!sbRes.ok) {
        const data = await sbRes.json().catch(() => ({}));
        throw new Error(data.msg || data.message || data.error_description || t("Неверный или просроченный код", "Invalid or expired code"));
      }
      const data = await sbRes.json();
      if (data.access_token) {
        localStorage.setItem("platform_access_token", data.access_token);
        localStorage.setItem("platform_user_id", data.user?.id || "");
        localStorage.setItem("platform_email", email.trim().toLowerCase());
        onAuthorized();
      } else {
        throw new Error(t("Не удалось получить токен доступа", "Failed to obtain access token"));
      }
    } catch (err: any) {
      setError(err.message || String(err));
      setStep("otp");
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "24px 16px",
        background: "#f8fafc",
        fontFamily: "var(--font-sans, 'Inter', system-ui, sans-serif)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "380px",
          background: "#fff",
          borderRadius: "18px",
          padding: "36px 32px",
          boxShadow: "0 8px 30px rgba(15, 23, 42, 0.08)",
          border: "1px solid #e2e8f0",
        }}
      >
        {/* Header language link */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div />
          <a
            href={isRu ? "/" : "/ru"}
            style={{ fontSize: "12px", color: "#64748b", textDecoration: "none", fontWeight: 600 }}
          >
            {isRu ? "🌐 English" : "🌐 Русский"}
          </a>
        </div>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div
            style={{
              width: "52px",
              height: "52px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
              color: "#fff",
              display: "inline-grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: "16px",
              marginBottom: "14px",
              boxShadow: "0 6px 18px rgba(15, 118, 110, 0.22)",
            }}
          >
            PST
          </div>
          <h1
            style={{
              margin: "0 0 6px",
              fontSize: "20px",
              fontWeight: 700,
              color: "#0f172a",
            }}
          >
            {t("Вход в терминал", "Terminal Sign In")}
          </h1>
          <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b" }}>
            {t("Введите корпоративную почту — пришлём код входа", "Enter your work email to receive a sign-in code")}
          </p>
        </div>

        {/* Alerts */}
        {error && (
          <div
            style={{
              background: "#fef2f2",
              border: "1px solid #fca5a5",
              color: "#991b1b",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13.5px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}
        {message && (
          <div
            style={{
              background: "#ecfdf5",
              border: "1px solid #a7f3d0",
              color: "#065f46",
              padding: "10px 14px",
              borderRadius: "8px",
              fontSize: "13.5px",
              marginBottom: "16px",
            }}
          >
            {message}
          </div>
        )}

        {step === "loading" && (
          <p style={{ textAlign: "center", color: "#64748b", fontSize: "14px" }}>
            {t("Пожалуйста, подождите...", "Please wait...")}
          </p>
        )}

        {step === "email" && (
          <form onSubmit={handleSendOtp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "none" }} aria-hidden="true">
              <input
                type="text"
                name="website_hp"
                tabIndex={-1}
                autoComplete="off"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="school-email"
                style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#374151" }}
              >
                {t("Корпоративная почта", "Work Email")}
              </label>
              <input
                id="school-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@school.ru"
                style={{
                  width: "100%",
                  padding: "11px 14px",
                  borderRadius: "9px",
                  border: "1.5px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  outline: "none",
                  fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <button
              type="submit"
              style={{
                padding: "12px",
                borderRadius: "9px",
                border: "none",
                background: "#0f766e",
                color: "#fff",
                fontWeight: 700,
                fontSize: "15px",
                cursor: "pointer",
              }}
            >
              {t("Получить код входа →", "Get Sign-In Code →")}
            </button>
          </form>
        )}

        {step === "otp" && (
          <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div>
              <label
                htmlFor="school-otp"
                style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#374151" }}
              >
                {t("Код из письма", "Verification Code")}
              </label>
              <input
                id="school-otp"
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                style={{
                  width: "100%",
                  padding: "12px",
                  borderRadius: "9px",
                  border: "1.5px solid #cbd5e1",
                  background: "#f8fafc",
                  color: "#0f172a",
                  outline: "none",
                  letterSpacing: "6px",
                  textAlign: "center",
                  fontSize: "22px",
                  fontWeight: 700,
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setStep("email")}
                style={{
                  flex: 1,
                  padding: "12px",
                  borderRadius: "9px",
                  border: "1px solid #cbd5e1",
                  background: "#f1f5f9",
                  color: "#334155",
                  fontWeight: 500,
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                {t("Назад", "Back")}
              </button>
              <button
                type="submit"
                style={{
                  flex: 2,
                  padding: "12px",
                  borderRadius: "9px",
                  border: "none",
                  background: "#0f766e",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "15px",
                  cursor: "pointer",
                }}
              >
                {t("Войти", "Sign In")}
              </button>
            </div>
          </form>
        )}

        {/* Footer & Collapsible Instructions */}
        <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid #f1f5f9" }}>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#94a3b8", lineHeight: 1.6, textAlign: "center" }}>
            {t("Впервые здесь?", "First time here?")}{" "}
            <a
              href={landingUrl}
              target="_blank"
              rel="noreferrer"
              style={{ color: "#0f766e", fontWeight: 600, textDecoration: "none" }}
            >
              {t("Узнать о Терминале →", "Learn about Terminal →")}
            </a>
          </p>

          <div style={{ marginTop: "16px", textAlign: "center" }}>
            <button
              type="button"
              onClick={() => setShowInstructions((prev) => !prev)}
              style={{
                background: "none",
                border: "none",
                color: "#0f766e",
                fontWeight: 600,
                fontSize: "13px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                borderRadius: "8px",
              }}
            >
              <span>📖 {t("Как развернуть рабочее место", "Setup Instructions")}</span>
              <span style={{ transform: showInstructions ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                ▼
              </span>
            </button>
          </div>

          {showInstructions && (
            <div
              style={{
                marginTop: "14px",
                padding: "16px",
                borderRadius: "12px",
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                textAlign: "left",
                fontSize: "12.5px",
                color: "#334155",
                lineHeight: "1.6",
              }}
            >
              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "8px", fontSize: "13px" }}>
                {t("1. Регистрация школы (в веб-версии)", "1. Register School (Web Version)")}
              </div>
              <ol style={{ margin: "0 0 12px", paddingLeft: "18px" }}>
                <li>{t("Введите ваш email выше и подтвердите 6-значный код из письма.", "Enter your email above and verify with the 6-digit code.")}</li>
                <li>{t("В мастере первичной настройки укажите роль (Руководитель или Психолог) и название школы.", "In the setup wizard, specify your role (Director or Psychologist) and school name.")}</li>
                <li>{t("Нажмите «Завершить настройку» — ваше веб-рабочее место создано.", "Click 'Finish Setup' — your web workspace is created.")}</li>
              </ol>

              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "8px", fontSize: "13px" }}>
                {t("2. Установка десктопного Терминала (ПК)", "2. Install Desktop Terminal (PC)")}
              </div>
              <p style={{ margin: "0 0 8px" }}>
                {t(
                  "Для шифрования данных учащихся (SQLCipher) и офлайн-режима установите приложение:",
                  "For local data encryption (SQLCipher) and offline support, install the app:"
                )}
              </p>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
                <a
                  href="https://prevention.school/dist/Prevention_Terminal_0.0.1_x64-setup.exe"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "#0f766e",
                    color: "#fff",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "11.5px",
                  }}
                >
                  ⬇ {t("Скачать .exe (Windows)", "Download .exe (Windows)")}
                </a>
                <a
                  href="https://prevention.school/dist/Prevention_Terminal_0.0.1_x64_en-US.msi"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "6px",
                    background: "#e2e8f0",
                    color: "#334155",
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "11.5px",
                  }}
                >
                  Пакет .msi
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
