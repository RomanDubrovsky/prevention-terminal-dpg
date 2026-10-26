import { useState, useEffect } from "react";
import { t } from "../lib/i18n.ts";
import { getTerminalEdition } from "../lib/terminal_edition.ts";
import { platformApiBase } from "../lib/platform_api.ts";
import VkOneTapWidget from "./VkOneTapWidget.tsx";

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
  const isAcademy = typeof window !== "undefined" && (
    window.location.hostname.includes("academy") ||
    new URLSearchParams(window.location.search).get("entry") === "creator"
  );
  const landingUrl = isAcademy
    ? "https://academy.ida-psy.ru/"
    : (isRu ? "https://ida-psy.ru/" : "https://ida-psy.pro/");

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
      if (!oauthToken) {
        const match = window.location.href.match(/[?&#]access_token=([^&#]+)/);
        if (match) oauthToken = match[1];
      }
      if (oauthToken) {
        localStorage.setItem("platform_access_token", oauthToken);
        try {
          localStorage.removeItem("prevention_terminal_demo_flag");
          localStorage.removeItem("prevention_terminal_demo_version");
          const rawStaging = localStorage.getItem("prevention_terminal_staging_v1");
          if (rawStaging) {
            const parsed = JSON.parse(rawStaging);
            if (
              parsed.terminalConfig?.terminal_user_id?.startsWith("tu-demo-") ||
              parsed.orgProfile?.display_name?.includes("Северная звезда") ||
              parsed.specialistProfile?.display_name?.includes("Воронова") ||
              parsed.specialistProfile?.display_name?.includes("Соколов") ||
              parsed.terminalConfig?.center_id?.includes("demo-")
            ) {
              localStorage.removeItem("prevention_terminal_staging_v1");
            }
          }
        } catch {}
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
        let search = newUrl.search;
        search = search.replace(/[?&]access_token=[^&]+/, "");
        if (search.startsWith("&")) search = "?" + search.slice(1);
        newUrl.search = search;
        
        let hash = newUrl.hash;
        hash = hash.replace(/[?&#]access_token=[^&]+/, "");
        if (hash === "#") hash = "";
        newUrl.hash = hash;
        
        window.history.replaceState({}, document.title, newUrl.toString());
        onAuthorized();
        return;
      }
    }
    
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
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          app_id: "ida_web_terminal",
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
          try {
            localStorage.removeItem("prevention_terminal_demo_flag");
            localStorage.removeItem("prevention_terminal_demo_version");
            const rawStaging = localStorage.getItem("prevention_terminal_staging_v1");
            if (rawStaging) {
              const parsed = JSON.parse(rawStaging);
              if (
                parsed.terminalConfig?.terminal_user_id?.startsWith("tu-demo-") ||
                parsed.orgProfile?.display_name?.includes("Северная звезда") ||
                parsed.specialistProfile?.display_name?.includes("Воронова") ||
                parsed.terminalConfig?.center_id?.includes("demo-")
              ) {
                localStorage.removeItem("prevention_terminal_staging_v1");
              }
            }
          } catch {}
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
            ← {isAcademy ? t("На сайт Академии", "To Academy Site") : t("На сайт IDA Psy", "To IDA Psy Site")}
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
            {isAcademy
              ? t("Вход в Студию Академии", "Academy Studio Sign In")
              : t("Вход в терминал", "Terminal Sign In")}
          </h1>
          <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b" }}>
            {isAcademy
              ? t("Введите почту ведущего — пришлём код входа", "Enter host email to receive a sign-in code")
              : t("Введите почту — пришлём код входа", "Enter your email to receive a sign-in code")}
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
                {t("Электронная почта", "Email")}
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

              <div style={{ display: "flex", alignItems: "center", margin: "10px 0", color: "#cbd5e1" }}>
                <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
                <span style={{ padding: "0 10px", fontSize: "13px", color: "#64748b" }}>{t("или", "or")}</span>
                <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }}></div>
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
                      width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0",
                      background: "#fff", color: "#1e293b", fontWeight: 600, fontSize: "14px", cursor: "pointer",
                      display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
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
                        window.location.href = `${platformApiBase()}/api/auth/yandex/login?return_to=${encodeURIComponent(returnTo)}&app_id=ida`;
                      }}
                      style={{
                        width: "100%", padding: "12px", borderRadius: "10px", border: "1px solid #e2e8f0",
                        background: "#fff", color: "#1e293b", fontWeight: 600, fontSize: "14px", cursor: "pointer",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: "8px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                      }}
                    >
                      <span style={{ color: "#ef4444", fontSize: "16px", fontWeight: "bold" }}>Я</span>
                      {t("Войти через Яндекс ID", "Continue with Yandex")}
                    </button>
                    <VkOneTapWidget appName="ida" onSuccess={onAuthorized} />
                  </>
                )}
              </div>
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
              {isAcademy
                ? t("Узнать об Академии IDA →", "Learn about IDA Academy →")
                : t("Узнать об IDA Терминале →", "Learn about IDA Terminal →")}
            </a>
          </p>
          {isAcademy && (
            <div style={{ marginTop: "14px", textAlign: "center" }}>
              <a
                href={typeof window !== "undefined" ? `${window.location.pathname}?entry=creator&demo=1` : "?entry=creator&demo=1"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  background: "#f1f5f9",
                  color: "#334155",
                  fontSize: "12.5px",
                  fontWeight: 600,
                  textDecoration: "none",
                  border: "1px solid #cbd5e1",
                  transition: "all 0.15s ease",
                }}
              >
                <span>🎮</span>
                <span>{t("Попробовать демо-студию без регистрации →", "Try demo studio without registration →")}</span>
              </a>
            </div>
          )}

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
