/** Shared helpers for AI narrative fields and document stems. */

/** Append a speech-dictation chunk to an existing textarea value. */
export function appendDictatedChunk(prev: string, chunk: string): string {
  const piece = String(chunk || "").trim();
  if (!piece) return prev;
  const base = String(prev || "").trim();
  return base ? `${base} ${piece}` : piece;
}

/** YYYY-MM-DD for Otchet_/Harakteristika_ file stems. */
export function formatIsoDateStem(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (!Number.isFinite(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export function architectDocStem(slug: string, iso?: string): string {
  return `${slug}_${formatIsoDateStem(iso)}`;
}
