import { useCallback, useEffect, useState } from "react";

import {
  fetchAdminMessages,
  markMessageRead,
  replyToMessage,
  type AdminMessage,
} from "../lib/admin_messages_client.ts";
import { t } from "../lib/i18n.ts";

interface AdminMessagesSectionProps {
  userId: string;
  audience: string;
  userName?: string;
  userOrg?: string;
  onUnreadChange?: (count: number) => void;
}

function formatDate(raw: string): string {
  const ts = Date.parse(raw);
  if (!Number.isFinite(ts)) return raw.slice(0, 16);
  return new Date(ts).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function severityIcon(severity: string): string {
  switch (severity) {
    case "important":
      return "🔔";
    case "update":
      return "🆕";
    default:
      return "📨";
  }
}

export default function AdminMessagesSection(props: AdminMessagesSectionProps) {
  const { userId, audience, userName, userOrg, onUnreadChange } = props;
  const [messages, setMessages] = useState<AdminMessage[]>([]);
  const [expandedReply, setExpandedReply] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [sentReplies, setSentReplies] = useState<Set<string>>(() => new Set());

  const refresh = useCallback(async () => {
    if (!userId) return;
    const items = await fetchAdminMessages(userId, audience);
    setMessages(items);
    const unread = items.filter((m) => !m.is_read).length;
    onUnreadChange?.(unread);
  }, [userId, audience, onUnreadChange]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function handleMarkRead(msg: AdminMessage) {
    if (msg.is_read) return;
    await markMessageRead(msg.id, userId);
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, is_read: true } : m)),
    );
    const newUnread = messages.filter((m) => !m.is_read && m.id !== msg.id).length;
    onUnreadChange?.(newUnread);
  }

  async function handleSendReply(messageId: string) {
    if (!replyText.trim() || sending) return;
    setSending(true);
    const ok = await replyToMessage(messageId, userId, replyText.trim(), userName, userOrg);
    setSending(false);
    if (ok) {
      setReplyText("");
      setExpandedReply(null);
      setSentReplies((prev) => new Set(prev).add(messageId));
    }
  }

  if (messages.length === 0) {
    return (
      <div className="admin-messages-section" style={{ padding: "24px 0", color: "var(--text-secondary)" }}>
        <p className="muted" style={{ margin: 0 }}>
          {t("Служебных сообщений и новостей пока нет.", "No system messages or updates yet.")}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-messages-section" style={{ marginBottom: "20px" }}>
      <h3 style={{ margin: "0 0 12px", fontSize: "1rem", fontWeight: 600, color: "var(--text)" }}>
        {severityIcon("info")} {t("Сообщения от разработчика", "Messages from developer")}
      </h3>

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {messages.map((msg) => {
          const isUnread = !msg.is_read;
          const isReplyOpen = expandedReply === msg.id;
          const alreadyReplied = sentReplies.has(msg.id);

          return (
            <div
              key={msg.id}
              style={{
                background: isUnread
                  ? "var(--surface-highlight, rgba(99, 102, 241, 0.06))"
                  : "var(--surface-soft, rgba(255,255,255,0.04))",
                border: `1px solid ${isUnread ? "var(--accent, #6366f1)" : "var(--border, #e5e7eb)"}`,
                borderRadius: "12px",
                padding: "14px 16px",
                borderLeftWidth: isUnread ? "4px" : "1px",
                transition: "border-color 0.2s, background 0.2s",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <span style={{ fontSize: "1.1rem" }}>{severityIcon(msg.severity)}</span>
                    <strong style={{ fontSize: "0.95rem", color: "var(--text)" }}>{msg.title}</strong>
                    {isUnread && (
                      <span
                        style={{
                          display: "inline-block",
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: "#ef4444",
                          flexShrink: 0,
                        }}
                      />
                    )}
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: "0.88rem", lineHeight: "1.5", color: "var(--text-secondary, #64748b)" }}>
                    {msg.content}
                  </p>
                </div>
                <span style={{ fontSize: "0.75rem", color: "var(--muted, #94a3b8)", whiteSpace: "nowrap", flexShrink: 0 }}>
                  {formatDate(msg.created_at)}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", gap: "8px", marginTop: "10px", alignItems: "center" }}>
                {isUnread && (
                  <button
                    type="button"
                    className="ob-btn ob-btn--ghost"
                    style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    onClick={() => void handleMarkRead(msg)}
                  >
                    ✓ {t("Прочитано", "Mark as read")}
                  </button>
                )}
                {!alreadyReplied ? (
                  <button
                    type="button"
                    className="ob-btn ob-btn--ghost"
                    style={{ fontSize: "0.8rem", padding: "4px 10px" }}
                    onClick={() => {
                      setExpandedReply(isReplyOpen ? null : msg.id);
                      setReplyText("");
                      if (isUnread) void handleMarkRead(msg);
                    }}
                  >
                    💬 {t("Ответить", "Reply")}
                  </button>
                ) : (
                  <span style={{ fontSize: "0.8rem", color: "var(--accent)", fontWeight: 500 }}>
                    ✓ {t("Ответ отправлен", "Reply sent")}
                  </span>
                )}
              </div>

              {/* Reply form */}
              {isReplyOpen && (
                <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={t("Ваш ответ разработчику...", "Your reply to the developer...")}
                    rows={3}
                    style={{
                      width: "100%",
                      borderRadius: "8px",
                      border: "1px solid var(--border)",
                      padding: "8px 10px",
                      fontSize: "0.88rem",
                      resize: "vertical",
                      fontFamily: "inherit",
                      background: "var(--surface, white)",
                      color: "var(--text)",
                    }}
                  />
                  <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      className="ob-btn ob-btn--ghost"
                      style={{ fontSize: "0.8rem", padding: "4px 12px" }}
                      onClick={() => setExpandedReply(null)}
                    >
                      {t("Отмена", "Cancel")}
                    </button>
                    <button
                      type="button"
                      className="ob-btn"
                      disabled={!replyText.trim() || sending}
                      style={{ fontSize: "0.8rem", padding: "4px 14px" }}
                      onClick={() => void handleSendReply(msg.id)}
                    >
                      {sending ? "..." : t("Отправить", "Send")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
