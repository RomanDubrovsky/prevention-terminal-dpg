import { useState, useEffect } from "react";
import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import { platformApiBase } from "../lib/platform_api.ts";
import VkOneTapWidget from "./VkOneTapWidget.tsx";
import "./SchoolWebGate.css";

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
  const landingUrl = isRu ? "https://prevention-ai.ru/ru/workspace/" : "https://prevention.school/workspace/";

  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("prevention_site_theme");
      if (saved === "dark" || saved === "light") return saved;
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  });

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    if (typeof window !== "undefined") {
      localStorage.setItem("prevention_site_theme", next);
      document.documentElement.setAttribute("data-theme", next);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get("auth_error");
      if (authError) {
        setError(t("Ошибка входа через внешнюю службу или авторизация отменена. Попробуйте снова.", "External authentication failed or was cancelled. Please try again."));
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("auth_error");
        window.history.replaceState({}, document.title, newUrl.toString());
      }

      let oauthToken = params.get("access_token");
      if (!oauthToken && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        oauthToken = hashParams.get("access_token");
      }
      if (oauthToken) {
        localStorage.setItem("platform_access_token", oauthToken);
        try {
          const parts = oauthToken.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(decodeURIComponent(escape(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")))));
            if (payload.email) {
              localStorage.setItem("platform_email", String(payload.email).toLowerCase());
            }
            if (payload.user_metadata?.full_name || payload.user_metadata?.name || payload.name) {
              localStorage.setItem("platform_name", payload.user_metadata?.full_name || payload.user_metadata?.name || payload.name);
            }
            if (payload.sub) {
              localStorage.setItem("platform_user_id", payload.sub);
            }
          }
        } catch {}

        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("access_token");
        newUrl.hash = "";
        window.history.replaceState({}, document.title, newUrl.toString());
        onAuthorized();
        return;
      }
    }

    const token = localStorage.getItem("platform_access_token");
    if (token) onAuthorized();
  }, [onAuthorized]);

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
      const baseUrl = platformApiBase();
      const res = await fetch(`${baseUrl}/api/auth/otp/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          app_id: "school_web_terminal",
          website: honeypot,
          locale: getTerminalEdition() === "intl" ? "en" : "ru",
        }),
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
      const baseUrl = platformApiBase();
      const res = await fetch(`${baseUrl}/api/auth/otp/verify`, {
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
    <div className="school-gate-page-wrap" data-theme={theme}>
      <div className="wrap">
        {/* Header matching main site */}
        <header className="site-header">
          <a
            className="brand"
            href={isRu ? "https://prevention-ai.ru/ru/" : "https://prevention.school/"}
          >
            <span className="brand-mark">{isRu ? "П" : "P"}</span>
            <span>
              {isRu ? "Профилактика-AI" : "Prevention-AI"}{" "}
              <small>Beta</small>
            </span>
          </a>

          <nav className="nav" aria-label={isRu ? "Навигация" : "Navigation"}>
            {isRu ? (
              <>
                <a href="https://prevention-ai.ru/ru/about/">О проекте</a>
                <a href="https://academy.prevention-ai.ru/" target="_blank" rel="noopener">Академия</a>
                <a href="/?entry=educator" target="_blank" rel="noopener">Учителю</a>
                <a href="https://prevention-ai.ru/ru/teenology/">Родителям и подросткам</a>
              </>
            ) : (
              <>
                <a href="https://prevention.school/about/">About</a>
                <a href="https://prevention.school/science/">Science</a>
                <a href="https://academy.ida-psy.ru/" target="_blank" rel="noopener">IDA Academy 🎓</a>
                <a href="/?entry=educator" target="_blank" rel="noopener">Educators</a>
                <a href="https://prevention.school/teenology/">Parents &amp; Teens</a>
              </>
            )}
          </nav>

          <div className="nav-controls">
            <a href="/" className="nav-cta">
              {isRu ? "Веб-терминал" : "Web Terminal"}
            </a>
            <button
              type="button"
              className="theme-toggle"
              id="theme-toggle"
              onClick={toggleTheme}
            >
              {theme === "light" ? (isRu ? "Темная" : "Dark") : (isRu ? "Светлая" : "Light")}
            </button>
            <a
              href={isRu ? "/" : "/ru"}
              style={{
                fontSize: "12.5px",
                fontWeight: 700,
                color: "var(--muted)",
                textDecoration: "none",
                padding: "6px 10px",
                border: "1px solid var(--line)",
                borderRadius: "8px",
                background: "var(--surface)",
              }}
            >
              {isRu ? "EN" : "RU"}
            </a>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="school-gate-main-content">
          <div className="school-gate-card">
            {/* Logo inside card */}
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "14px",
                  background: "linear-gradient(135deg, var(--accent) 0%, var(--accent-strong) 100%)",
                  color: "#fff",
                  display: "inline-grid",
                  placeItems: "center",
                  fontWeight: 800,
                  fontSize: "15px",
                  marginBottom: "12px",
                  boxShadow: "0 6px 18px rgba(15, 118, 110, 0.22)",
                }}
              >
                PST
              </div>
              <h1
                style={{
                  margin: "0 0 6px",
                  fontSize: "20px",
                  fontWeight: 800,
                  color: "var(--text)",
                }}
              >
                {t("Кабинет психолога и директора", "Psychologist & Director Workspace")}
              </h1>
              <p style={{ margin: 0, fontSize: "13.5px", color: "var(--muted)" }}>
                {t("Введите почту — пришлём код входа", "Enter your email to receive a sign-in code")}
              </p>
            </div>

            {/* Alerts */}
            {error && (
              <div
                style={{
                  background: "rgba(239, 68, 68, 0.1)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#ef4444",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontSize: "13.5px",
                  marginBottom: "16px",
                  lineHeight: 1.45,
                }}
              >
                {error}
              </div>
            )}
            {message && (
              <div
                style={{
                  background: "var(--accent-soft)",
                  border: "1px solid color-mix(in srgb, var(--accent) 40%, transparent)",
                  color: "var(--accent-strong)",
                  padding: "10px 14px",
                  borderRadius: "10px",
                  fontSize: "13.5px",
                  marginBottom: "16px",
                  lineHeight: 1.45,
                }}
              >
                {message}
              </div>
            )}

            {step === "loading" && (
              <p style={{ textAlign: "center", color: "var(--muted)", fontSize: "14px", padding: "16px 0" }}>
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
                    style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}
                  >
                    {t("Электронная почта", "Email")}
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
                      borderRadius: "10px",
                      border: "1.5px solid var(--line)",
                      background: "var(--surface-soft)",
                      color: "var(--text)",
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
                    borderRadius: "10px",
                    border: "none",
                    background: "var(--accent)",
                    color: "#fff",
                    fontWeight: 750,
                    fontSize: "14.5px",
                    cursor: "pointer",
                    transition: "background 0.15s ease",
                  }}
                >
                  {t("Получить код входа →", "Get Sign-In Code →")}
                </button>

                <div style={{ display: "flex", alignItems: "center", margin: "8px 0", color: "var(--line)" }}>
                  <div style={{ flex: 1, height: "1px", background: "var(--line)" }}></div>
                  <span style={{ padding: "0 10px", fontSize: "12.5px", color: "var(--muted)" }}>{t("или", "or")}</span>
                  <div style={{ flex: 1, height: "1px", background: "var(--line)" }}></div>
                </div>

                <div style={{ display: "flex", gap: "10px", flexDirection: "column" }}>
                  {!isRu && (
                    <button
                      type="button"
                      onClick={() => {
                        const returnTo = window.location.origin + window.location.pathname;
                        window.location.href = `https://ecppmcsceglmqsogijws.supabase.co/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(returnTo)}`;
                      }}
                      style={{
                        width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid var(--line)",
                        background: "var(--surface)", color: "var(--text)", fontWeight: 600, fontSize: "14px", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                      }}
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                      </svg>
                      {t("Войти через Google", "Continue with Google")}
                    </button>
                  )}

                  {isRu && (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          const returnTo = window.location.href;
                          window.location.href = `${platformApiBase()}/api/auth/yandex/login?return_to=${encodeURIComponent(returnTo)}&app_id=school_web_terminal`;
                        }}
                        style={{
                          width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid var(--line)",
                          background: "var(--surface)", color: "var(--text)", fontWeight: 600, fontSize: "14px", cursor: "pointer",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
                        }}
                      >
                        <span style={{ color: "#ef4444", fontSize: "16px", fontWeight: "bold" }}>Я</span>
                        {t("Войти через Яндекс ID", "Continue with Yandex")}
                      </button>
                      <VkOneTapWidget appName="school_web_terminal" onSuccess={onAuthorized} />
                    </>
                  )}
                </div>
              </form>
            )}

            {step === "otp" && (
              <form onSubmit={handleVerifyOtp} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <label
                    htmlFor="school-otp"
                    style={{ display: "block", marginBottom: "6px", fontSize: "13px", fontWeight: 600, color: "var(--text)" }}
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
                      borderRadius: "10px",
                      border: "1.5px solid var(--line)",
                      background: "var(--surface-soft)",
                      color: "var(--text)",
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
                      borderRadius: "10px",
                      border: "1px solid var(--line)",
                      background: "var(--surface-soft)",
                      color: "var(--text)",
                      fontWeight: 600,
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
                      borderRadius: "10px",
                      border: "none",
                      background: "var(--accent)",
                      color: "#fff",
                      fontWeight: 750,
                      fontSize: "14.5px",
                      cursor: "pointer",
                    }}
                  >
                    {t("Войти", "Sign In")}
                  </button>
                </div>
              </form>
            )}

            {/* Footer & Collapsible Instructions inside card */}
            <div style={{ marginTop: "24px", paddingTop: "18px", borderTop: "1px solid var(--line)" }}>
              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.6, textAlign: "center" }}>
                {t("Впервые здесь?", "First time here?")}{" "}
                <a
                  href={landingUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
                >
                  {t("Узнать о Терминале →", "Learn about Terminal →")}
                </a>
              </p>
              <p style={{ margin: "8px 0 0", fontSize: "12.5px", color: "var(--muted)", lineHeight: 1.6, textAlign: "center" }}>
                {t("Классным руководителям и учителям:", "For homeroom teachers & educators:")}{" "}
                <a
                  href="/?entry=educator"
                  style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}
                >
                  {t("Рабочее место педагога →", "Educator Workspace →")}
                </a>
              </p>

              <div style={{ marginTop: "16px", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowInstructions((prev) => !prev)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--accent)",
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
                    background: "var(--surface-soft)",
                    border: "1px solid var(--line)",
                    textAlign: "left",
                    fontSize: "12.5px",
                    color: "var(--text)",
                    lineHeight: "1.6",
                  }}
                >
                  <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "8px", fontSize: "13px" }}>
                    {t("1. Регистрация школы (в веб-версии)", "1. Register School (Web Version)")}
                  </div>
                  <ol style={{ margin: "0 0 12px", paddingLeft: "18px", color: "var(--muted)" }}>
                    <li>{t("Введите ваш email выше и подтвердите 6-значный код из письма.", "Enter your email above and verify with the 6-digit code.")}</li>
                    <li>{t("В мастере первичной настройки укажите роль (Руководитель или Психолог) и название школы.", "In the setup wizard, specify your role (Director or Psychologist) and school name.")}</li>
                    <li>{t("Нажмите «Завершить настройку» — ваше веб-рабочее место создано.", "Click 'Finish Setup' — your web workspace is created.")}</li>
                  </ol>

                  <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: "8px", fontSize: "13px" }}>
                    {t("2. Установка десктопного Терминала (ПК)", "2. Install Desktop Terminal (PC)")}
                  </div>
                  <p style={{ margin: "0 0 8px", color: "var(--muted)" }}>
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
                        background: "var(--accent)",
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
                        background: "var(--surface)",
                        color: "var(--text)",
                        border: "1px solid var(--line)",
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
        </main>

        {/* Footer matching main site */}
        <footer className="footer">
          <div className="footer-grid">
            <div className="footer-about">
              <strong>{isRu ? "Профилактика-AI" : "Prevention-AI"}</strong><br />
              {isRu
                ? "Открытая цифровая инфраструктура психологической службы образования."
                : "Open digital infrastructure for psychological services in education and youth policy."}
              <p className="footer-legal-notice">
                {isRu
                  ? "В настоящее время Платформа проходит процедуру включения в Реестр отечественного программного обеспечения Минцифры России. Система работает в режиме открытой апробации и доступна специалистам и образовательным организациям для ознакомления и использования. Размещение серверных компонентов — защищенные сертифицированные ЦОД (152-ФЗ)."
                  : "Built to comply with international data protection frameworks (GDPR, FERPA) and professional ethics standards. Cloud components deployed in certified secure cloud infrastructure. The platform operates in open pilot mode for evaluation, testing, and institutional deployment."}
              </p>
              <p className="footer-contact">
                <a href="mailto:admin@prevention-ai.ru">admin@prevention-ai.ru</a>
                <span className="footer-contact-sep" aria-hidden="true">·</span>
                <a href="https://t.me/RomanDubrovsky" target="_blank" rel="noopener noreferrer">Telegram</a>
                <span className="footer-contact-sep" aria-hidden="true">·</span>
                <a href={isRu ? "https://prevention-ai.ru/ru/founder/" : "https://prevention.school/founder/"}>
                  {isRu ? "Автор проекта" : "Founder"}
                </a>
              </p>
              {isRu && (
                <p className="footer-community">
                  Сообщества проекта:<br />
                  ВКонтакте: <a href="https://vk.ru/prevention_ai" target="_blank" rel="noopener">vk.ru/prevention_ai</a><br />
                  Телеграм-канал: <a href="https://t.me/anthropology_health" target="_blank" rel="noopener">t.me/anthropology_health</a>
                </p>
              )}
            </div>
            <nav className="footer-links" aria-label="Footer">
              {isRu ? (
                <>
                  <a href="https://prevention-ai.ru/ru/about/">О проекте</a>
                  <a href="https://academy.prevention-ai.ru/" target="_blank" rel="noopener">Академия</a>
                  <a href="/?entry=educator" target="_blank" rel="noopener">Учителю</a>
                  <a href="https://prevention-ai.ru/ru/teenology/">Родителям и подросткам</a>
                  <a href="https://prevention-ai.ru/ru/founder/">Основатель</a>
                  <a href="https://ida-psy.ru/" target="_blank" rel="noopener" style={{ color: "#8b5cf6", fontWeight: 600 }}>Психологам коммерческого сектора</a>
                  <a href="https://prevention-ai.ru/ru/privacy/">Конфиденциальность</a>
                  <a href="https://prevention-ai.ru/ru/consent/">Согласие на обработку</a>
                </>
              ) : (
                <>
                  <a href="https://academy.ida-psy.ru/" target="_blank" rel="noopener">IDA Academy 🎓</a>
                  <a href="https://prevention.school/event/">Live Events</a>
                  <a href="https://prevention.school/government/">Government &amp; Municipalities</a>
                  <a href="/?entry=educator" target="_blank" rel="noopener">Educators</a>
                  <a href="https://prevention.school/science/">Science</a>
                  <a href="https://prevention.school/pilot/">Pilot Project</a>
                  <a href="https://prevention.school/about/">About Project</a>
                  <a href="https://prevention.school/founder/">Founder</a>
                  <a href="https://prevention.school/teenology/">Teenology</a>
                  <a href="https://ida-psy.pro/" target="_blank" rel="noopener" style={{ color: "#8b5cf6", fontWeight: 600 }}>For Commercial Psychologists</a>
                  <a href="https://prevention.school/privacy/">Privacy Policy</a>
                </>
              )}
            </nav>
          </div>
        </footer>
      </div>
    </div>
  );
}
