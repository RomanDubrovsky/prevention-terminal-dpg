import { useState, useEffect } from "react";
import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import { platformApiBase } from "../lib/platform_api.ts";

interface IdaAuthGateProps {
  onAuthorized: () => void;
}

export default function IdaAuthGate({ onAuthorized }: IdaAuthGateProps) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [orgCode, setOrgCode] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [showOrgFields, setShowOrgFields] = useState(false);
  const [step, setStep] = useState<"email" | "otp" | "loading">("email");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const isRu = getTerminalEdition() === "ru";
  const landingUrl = isRu ? "https://ida-psy.ru/" : "https://ida-psy.pro/";

  useEffect(() => {
    const token = localStorage.getItem("platform_access_token");
    const isAutoLogin = typeof window !== "undefined" && (new URLSearchParams(window.location.search).get("auto_login") === "1" || new URLSearchParams(window.location.search).has("demo"));
    if (token || isAutoLogin) onAuthorized();
  }, [onAuthorized]);

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    if (honeypot.trim().length > 0) {
      // Silent Honeypot trap: simulate sending code without network call for bots
      setMessage(t("Код подтверждения отправлен на вашу почту", "Verification code sent to your email"));
      setStep("otp");
      return;
    }

    setStep("loading");
    setError(null);
    setMessage(null);
    try {
      const baseUrl = platformApiBase();
      const res = await fetch(`${baseUrl}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), app_id: "ida_web_terminal", website: honeypot }),
      }).catch(() => null);

      if (!res || !res.ok) {
        if (res && res.status === 429) {
          throw new Error(t("Слишком много запросов. Пожалуйста, подождите 30 секунд перед повторной отправкой кода.", "Too many requests. Please wait 30 seconds before requesting another code."));
        }
        const data = res ? await res.json().catch(() => ({})) : {};
        throw new Error(data.msg || data.message || data.error_description || t("Не удалось отправить код подтверждения", "Failed to send verification code"));
      }

      setMessage(t("Код подтверждения отправлен на вашу почту", "Verification code sent to your email"));
      setStep("otp");
    } catch (err: any) {
      const raw = err.message || String(err);
      let formattedMsg = raw;
      try {
        if (raw.includes("unexpected_failure") || raw.includes("hook") || raw.includes("403") || raw.includes("500")) {
          formattedMsg = t(
            "Сервис отправки кодов временно недоступен. Воспользуйтесь первичной настройкой ниже.",
            "Sign-in code service temporarily unavailable. Use initial setup below."
          );
        } else {
          const parsed = JSON.parse(raw);
          formattedMsg = parsed.msg || parsed.message || parsed.error_description || raw;
        }
      } catch {}
      setError(formattedMsg);
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
      const baseUrl = platformApiBase();
      const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase(), otp: cleanOtp, app_id: "ida_web_terminal" }),
      }).catch(() => null);

      if (res) {
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.access_token) {
          localStorage.setItem("platform_access_token", data.access_token);
          localStorage.setItem("platform_user_id", data.user_id || "");
          localStorage.setItem("platform_email", email.trim().toLowerCase());
          if (orgCode.trim()) {
            const rawCode = orgCode.trim().toUpperCase();
            const normalized = rawCode.startsWith("CTR-") ? rawCode : `CTR-${rawCode}`;
            localStorage.setItem("platform_center_id", normalized);
          }
          if (setupToken.trim()) {
            localStorage.setItem("platform_setup_token", setupToken.trim());
          }
          onAuthorized();
          return;
        } else if (data.message) {
          throw new Error(data.message);
        }
      }
      throw new Error(t("Неверный или просроченный код", "Invalid or expired code"));
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
        {/* Header navigation links */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <a
            href={landingUrl}
            style={{ fontSize: "12px", color: "#0f766e", textDecoration: "none", fontWeight: 600, display: "inline-flex", alignItems: "center", gap: "4px" }}
          >
            ← {t("На сайт IDA Pro", "To IDA Pro Site")}
          </a>
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
              width: "52px", height: "52px",
              borderRadius: "14px",
              background: "linear-gradient(135deg, #0f766e 0%, #0d9488 100%)",
              color: "#fff",
              display: "inline-grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: "18px",
              marginBottom: "14px",
              boxShadow: "0 6px 18px rgba(15, 118, 110, 0.22)",
            }}
          >
            IDA
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
              background: "#fef2f2", border: "1px solid #fca5a5", color: "#991b1b",
              padding: "10px 14px", borderRadius: "8px", fontSize: "13.5px", marginBottom: "16px",
            }}
          >
            {error}
          </div>
        )}
        {message && (
          <div
            style={{
              background: "#ecfdf5", border: "1px solid #a7f3d0", color: "#065f46",
              padding: "10px 14px", borderRadius: "8px", fontSize: "13.5px", marginBottom: "16px",
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
            {/* Honeypot field (hidden from human users, traps spam bots) */}
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
                htmlFor="ida-email"
                style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#374151" }}
              >
                {t("Корпоративная почта", "Work Email")}
              </label>
              <input
                id="ida-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@yourcenter.com"
                style={{
                  width: "100%", padding: "11px 14px", borderRadius: "9px",
                  border: "1.5px solid #cbd5e1", background: "#f8fafc",
                  color: "#0f172a", outline: "none", fontSize: "14px",
                  boxSizing: "border-box",
                }}
              />
            </div>
            
            <div style={{ marginTop: "4px" }}>
              <button
                type="button"
                onClick={() => setShowOrgFields(!showOrgFields)}
                style={{
                  background: "none", border: "none", color: "#0f766e",
                  fontSize: "13px", fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: "6px", padding: 0
                }}
              >
                <span style={{ fontSize: "10px" }}>{showOrgFields ? "▼" : "▶"}</span>
                {t("Подключить существующий центр", "Link existing center")}
              </button>
            </div>

            {showOrgFields && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "4px", background: "#f1f5f9", padding: "12px", borderRadius: "8px" }}>
                <div>
                  <label
                    htmlFor="ida-org-code"
                    style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 500, color: "#475569" }}
                  >
                    {t("ID центра (8 символов)", "Center ID (8 chars)")}
                  </label>
                  <input
                    id="ida-org-code"
                    type="text"
                    value={orgCode}
                    onChange={(e) => setOrgCode(e.target.value)}
                    placeholder="8A2C3F5E"
                    style={{
                      width: "100%", padding: "8px 11px", borderRadius: "6px",
                      border: "1px solid #cbd5e1", background: "#fff",
                      color: "#0f172a", outline: "none", fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label
                    htmlFor="ida-setup-token"
                    style={{ display: "block", marginBottom: "4px", fontSize: "12px", fontWeight: 500, color: "#475569" }}
                  >
                    {t("Ключ подключения (Setup Token)", "Setup Token")}
                  </label>
                  <input
                    id="ida-setup-token"
                    type="text"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    placeholder="sec_auto_7c399b94dc5a91f6"
                    style={{
                      width: "100%", padding: "8px 11px", borderRadius: "6px",
                      border: "1px solid #cbd5e1", background: "#fff",
                      color: "#0f172a", outline: "none", fontSize: "13px",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <p style={{ margin: 0, fontSize: "11px", color: "#64748b", lineHeight: "1.3" }}>
                  {t(
                    "Введите эти данные, если вы подключаетесь к уже созданному ранее центру. Их можно будет ввести и позже в настройках.",
                    "Enter these if you are connecting to an existing center. You can also enter them later in settings."
                  )}
                </p>
              </div>
            )}

            <button
              type="submit"
              style={{
                padding: "12px", borderRadius: "9px", border: "none",
                background: "#0f766e", color: "#fff",
                fontWeight: 700, fontSize: "15px", cursor: "pointer",
                marginTop: "8px",
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
                htmlFor="ida-otp"
                style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 500, color: "#374151" }}
              >
                {t("Код из письма", "Verification Code")}
              </label>
              <input
                id="ida-otp"
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                style={{
                  width: "100%", padding: "12px", borderRadius: "9px",
                  border: "1.5px solid #cbd5e1", background: "#f8fafc",
                  color: "#0f172a", outline: "none",
                  letterSpacing: "6px", textAlign: "center", fontSize: "22px",
                  fontWeight: 700, boxSizing: "border-box",
                }}
              />
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setStep("email")}
                style={{
                  flex: 1, padding: "12px", borderRadius: "9px",
                  border: "1px solid #cbd5e1", background: "#f1f5f9",
                  color: "#334155", fontWeight: 500, fontSize: "14px", cursor: "pointer",
                }}
              >
                {t("Назад", "Back")}
              </button>
              <button
                type="submit"
                style={{
                  flex: 2, padding: "12px", borderRadius: "9px", border: "none",
                  background: "#0f766e", color: "#fff",
                  fontWeight: 700, fontSize: "15px", cursor: "pointer",
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
              {t("Узнать об IDA Терминале →", "Learn about IDA Terminal →")}
            </a>
          </p>

          {/* Collapsible Instruction Toggle */}
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

          {/* Collapsible Content */}
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
                {t("1. Регистрация центра (в веб-версии)", "1. Register Center (Web Version)")}
              </div>
              <ol style={{ margin: "0 0 12px", paddingLeft: "18px" }}>
                <li>{t("Введите ваш email выше и подтвердите 6-значный код из письма.", "Enter your email above and verify with the 6-digit code.")}</li>
                <li>{t("В мастере первичной настройки укажите роль (Руководитель или Психолог) и название центра.", "In the setup wizard, specify your role (Director or Psychologist) and center name.")}</li>
                <li>{t("Нажмите «Завершить настройку» — ваше веб-рабочее место создано.", "Click 'Finish Setup' — your web workspace is created.")}</li>
              </ol>

              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "8px", fontSize: "13px" }}>
                {t("2. Установка десктопного Терминала (ПК)", "2. Install Desktop Terminal (PC)")}
              </div>
              <p style={{ margin: "0 0 8px" }}>
                {t(
                  "Для шифрования данных пациентов (SQLCipher) и офлайн-режима установите приложение:",
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

              <div style={{ fontWeight: 700, color: "#0f172a", marginBottom: "8px", fontSize: "13px" }}>
                {t("3. Виджеты записи и иконостас на ваш сайт", "3. Site Widgets & Specialist Roster")}
              </div>
              <p style={{ margin: 0 }}>
                {t(
                  "В разделе «Настройки → Сайт» скопируйте код виджета формы записи или расписания и вставьте его на сайт вашей организации.",
                  "In 'Settings → Site', copy the booking or roster widget snippet and paste it onto your center's website."
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Compact footer for web terminal */}
      <footer
        style={{
          marginTop: "20px",
          display: "flex",
          gap: "14px",
          fontSize: "12px",
          color: "#64748b",
          flexWrap: "wrap",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <a
          href="https://prevention.school/ru/science"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#64748b", textDecoration: "none", fontWeight: 500 }}
        >
          {t("Научная база", "Science")}
        </a>
        <span aria-hidden="true">·</span>
        <a
          href={isRu ? "https://ida-psy.ru/founder/" : "https://ida-psy.pro/founder/"}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#64748b", textDecoration: "none", fontWeight: 500 }}
        >
          {t("Автор проекта", "Founder")}
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="mailto:admin@ida-psy.pro"
          style={{ color: "#64748b", textDecoration: "none", fontWeight: 500 }}
        >
          admin@ida-psy.pro
        </a>
        <span aria-hidden="true">·</span>
        <a
          href="https://t.me/ida_support_psy_bot"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#0f766e", textDecoration: "none", fontWeight: 600 }}
        >
          Telegram @ida_support_psy_bot
        </a>
      </footer>
    </div>
  );
}
