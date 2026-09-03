import { platformApiBase } from "./platform_api.ts";

function apiBase(): string {
  return platformApiBase();
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as T & { ok?: boolean; error?: string };
  if (!res.ok || data.ok === false) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function parseUploadedDocument(file: File): Promise<{ text: string; structured: boolean }> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const content_base64 = btoa(binary);
  const data = await postJson<{ text: string; structured: boolean }>("/api/terminal/documents/parse", {
    filename: file.name,
    content_base64,
  });
  return { text: data.text, structured: data.structured };
}

export async function extractDocumentSegments(text: string): Promise<Record<string, string>> {
  const data = await postJson<{ segments: Record<string, string> }>("/api/terminal/documents/segments", { text });
  return data.segments;
}
