import { platformApiBase } from "./platform_api.ts";

export interface AdminMessage {
  id: string;
  title: string;
  content: string;
  audience: string;
  severity: "info" | "important" | "update";
  created_at: string;
  is_read: boolean;
}

export async function fetchAdminMessages(
  userId: string,
  audience: string,
  limit = 20,
): Promise<AdminMessage[]> {
  const base = platformApiBase();
  const url = new URL(`${base}/api/terminal/admin-messages`);
  url.searchParams.set("user_id", userId);
  url.searchParams.set("audience", audience);
  url.searchParams.set("limit", String(limit));
  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.messages || []) as AdminMessage[];
  } catch {
    return [];
  }
}

export async function fetchUnreadCount(
  userId: string,
  audience: string,
): Promise<number> {
  const base = platformApiBase();
  const url = new URL(`${base}/api/terminal/admin-messages/unread-count`);
  url.searchParams.set("user_id", userId);
  url.searchParams.set("audience", audience);
  try {
    const resp = await fetch(url.toString());
    if (!resp.ok) return 0;
    const data = await resp.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export async function markMessageRead(
  messageId: string,
  userId: string,
): Promise<boolean> {
  const base = platformApiBase();
  try {
    const resp = await fetch(
      `${base}/api/terminal/admin-messages/${encodeURIComponent(messageId)}/read`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      },
    );
    return resp.ok;
  } catch {
    return false;
  }
}

export async function replyToMessage(
  messageId: string,
  userId: string,
  content: string,
  userName?: string,
  userOrg?: string,
): Promise<boolean> {
  const base = platformApiBase();
  try {
    const resp = await fetch(
      `${base}/api/terminal/admin-messages/${encodeURIComponent(messageId)}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          content,
          user_name: userName,
          user_org: userOrg,
        }),
      },
    );
    return resp.ok;
  } catch {
    return false;
  }
}
