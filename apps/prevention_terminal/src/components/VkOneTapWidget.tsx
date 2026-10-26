import { useState } from "react";
import { t } from "../lib/i18n.ts";
import { platformApiBase } from "../lib/platform_api";

export interface VkWidgetProps {
  appId?: number;
  appName?: string;
  onSuccess?: () => void;
  style?: React.CSSProperties;
}

export default function VkOneTapWidget({
  appName = "school_web_terminal",
  style,
}: VkWidgetProps) {
  const [loading, setLoading] = useState(false);

  const handleVkLogin = () => {
    setLoading(true);
    try {
      const u = new URL(window.location.href);
      u.searchParams.delete("access_token");
      u.searchParams.delete("auth_error");
      const returnTo = u.toString();
      const appIdParam = appName ? `&app_id=${encodeURIComponent(appName)}` : "";
      window.location.href = `${platformApiBase()}/api/auth/vk/login?return_to=${encodeURIComponent(returnTo)}${appIdParam}`;
    } catch (_) {
      const returnTo = window.location.href;
      const appIdParam = appName ? `&app_id=${encodeURIComponent(appName)}` : "";
      window.location.href = `${platformApiBase()}/api/auth/vk/login?return_to=${encodeURIComponent(returnTo)}${appIdParam}`;
    }
  };

  return (
    <button
      type="button"
      disabled={loading}
      onClick={handleVkLogin}
      style={{
        width: "100%",
        padding: "12px",
        borderRadius: "10px",
        border: "1px solid #e2e8f0",
        background: "#fff",
        color: "#1e293b",
        fontWeight: 600,
        fontSize: "14px",
        cursor: loading ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
        transition: "all 0.2s ease",
        opacity: loading ? 0.7 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.background = "#f8fafc";
          e.currentTarget.style.borderColor = "#cbd5e1";
        }
      }}
      onMouseLeave={(e) => {
        if (!loading) {
          e.currentTarget.style.background = "#fff";
          e.currentTarget.style.borderColor = "#e2e8f0";
        }
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="#0077FF">
        <path d="M15.07 2H8.93C4.16 2 2 4.16 2 8.93v6.14C2 19.84 4.16 22 8.93 22h6.14c4.77 0 6.93-2.16 6.93-6.93V8.93C22 4.16 19.84 2 15.07 2zm3.38 12.87h-1.57c-.6 0-.78-.48-1.85-1.55-.93-.91-1.34-1.03-1.57-1.03-.32 0-.41.09-.41.53v1.38c0 .38-.12.67-1.2.67-1.78 0-3.76-1.08-5.16-3.1-2.1-3.03-2.68-5.32-2.68-5.78 0-.25.1-.48.58-.48h1.57c.44 0 .61.2.78.68.85 2.47 2.28 4.64 2.87 4.64.22 0 .32-.1.32-.66v-2.6c-.07-1.18-.69-1.28-.69-1.7 0-.2.17-.4.44-.4h2.46c.35 0 .48.18.48.6v3.52c0 .38.17.51.28.51.23 0 .42-.13.84-.55 1.3-1.46 2.22-3.72 2.22-3.72.12-.25.33-.48.77-.48h1.57c.47 0 .58.24.47.58-.2 1.01-2.34 4.01-2.44 4.16-.2.32-.28.46 0 .84.2.27.88.86 1.33 1.38.83.94 1.47 1.73 1.64 2.28.18.53-.09.81-.59.81z" />
      </svg>
      {loading ? t("Переход в VK ID...", "Connecting to VK ID...") : t("Войти через VK ID", "Continue with VK ID")}
    </button>
  );
}