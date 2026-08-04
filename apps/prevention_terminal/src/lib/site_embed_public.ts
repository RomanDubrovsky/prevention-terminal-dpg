export interface IdaSiteWidgets {
  center_id: string;
  embed_snippet: string;
  registration_embed_snippet: string;
  iconostasis_embed_snippet: string;
  inbox_viewer_embed_snippet: string;
  inbox_viewer_url: string;
  lead_sink_url?: string;
  iconostasis_columns?: string;
}

/** Inbox URLs that only work on the PC running the terminal. */
export function isLocalLeadSink(url: string): boolean {
  const u = String(url || "").trim().toLowerCase();
  if (!u) return false;
  if (u.includes("127.0.0.1") || u.includes("localhost")) return true;
  if (u.startsWith("http://192.168.") || u.startsWith("https://192.168.")) return true;
  if (u.startsWith("http://10.") || u.startsWith("https://10.")) return true;
  return false;
}

export function publicLeadSinkForEmbed(url: string): string {
  return isLocalLeadSink(url) ? "" : String(url || "").trim();
}

/** Platform placeholder URLs must not appear in public site embeds. */
export function isPlatformConsultPlaceholder(url: string): boolean {
  const u = String(url || "").trim().toLowerCase().replace(/\/+$/, "");
  if (!u) return false;
  return (
    u === "https://prevention.school/ida" ||
    u === "https://prevention.school/ida/setup" ||
    u.endsWith("/prevention.school/ida") ||
    u.endsWith("/prevention.school/ida/setup")
  );
}

export function publicConsultUrlForEmbed(url: string): string {
  const u = String(url || "").trim();
  if (!u || isPlatformConsultPlaceholder(u)) return "";
  return u;
}

export function stripLocalhostFromEmbedSnippet(html: string): string {
  let out = String(html || "");
  out = out.replace(/\s*data-lead-sink="[^"]*"/gi, (match) => {
    const inner = match.match(/data-lead-sink="([^"]*)"/i)?.[1] || "";
    return isLocalLeadSink(inner) ? "" : match;
  });
  out = out.replace(/\s*data-consult-url="([^"]*)"/gi, (_match, url: string) => {
    const clean = publicConsultUrlForEmbed(url);
    return clean ? `  data-consult-url="${clean}"` : "";
  });
  return out;
}

export function sanitizeIdaSiteWidgets(widgets: IdaSiteWidgets): IdaSiteWidgets {
  const viewer = String(widgets.inbox_viewer_url || "").trim();
  const localViewer = isLocalLeadSink(viewer);
  return {
    ...widgets,
    embed_snippet: stripLocalhostFromEmbedSnippet(widgets.embed_snippet),
    lead_sink_url: publicLeadSinkForEmbed(widgets.lead_sink_url || ""),
    inbox_viewer_embed_snippet: localViewer ? "" : widgets.inbox_viewer_embed_snippet,
    inbox_viewer_url: localViewer ? "" : viewer,
  };
}
