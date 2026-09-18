import React, { useEffect, useState } from "react";

export function getSendOnEnterPreference(): boolean {
  if (typeof window === "undefined") return true;
  const stored = localStorage.getItem("chat_send_on_enter");
  return stored === null ? true : stored === "true";
}

export function setSendOnEnterPreference(val: boolean): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("chat_send_on_enter", String(val));
  window.dispatchEvent(new CustomEvent("chat_send_on_enter_changed", { detail: val }));
}

export function useSendOnEnter() {
  const [sendOnEnter, setSendOnEnter] = useState<boolean>(getSendOnEnterPreference());

  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "chat_send_on_enter") {
        setSendOnEnter(e.newValue === null ? true : e.newValue === "true");
      }
    };
    const handleCustom = (e: Event) => {
      const customEvent = e as CustomEvent<boolean>;
      setSendOnEnter(customEvent.detail);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("chat_send_on_enter_changed", handleCustom);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("chat_send_on_enter_changed", handleCustom);
    };
  }, []);

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>,
    onSend: () => void
  ) => {
    if (e.key === "Enter") {
      if (sendOnEnter) {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          onSend();
        }
      } else {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onSend();
        }
      }
    }
  };

  return { sendOnEnter, setSendOnEnter: setSendOnEnterPreference, handleKeyDown };
}

export function SendOnEnterToggle({
  className = "",
  style = {},
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const { sendOnEnter, setSendOnEnter } = useSendOnEnter();

  return (
    <button
      type="button"
      className={`send-on-enter-toggle ${className}`}
      onClick={() => setSendOnEnter(!sendOnEnter)}
      title={
        sendOnEnter
          ? "Режим: Enter для отправки (Shift+Enter для новой строки). Нажмите для переключения на Ctrl+Enter."
          : "Режим: Ctrl+Enter для отправки (Enter для новой строки). Нажмите для переключения на Enter."
      }
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 8px",
        borderRadius: "6px",
        fontSize: "0.75rem",
        fontWeight: 500,
        cursor: "pointer",
        background: "var(--card-alt, rgba(0, 0, 0, 0.05))",
        border: "1px solid var(--border, #cbd5e1)",
        color: "var(--muted-foreground, #64748b)",
        transition: "all 0.15s ease",
        userSelect: "none",
        ...style,
      }}
    >
      <span>{sendOnEnter ? "↵ Enter" : "Ctrl+Enter ↵"}</span>
    </button>
  );
}
