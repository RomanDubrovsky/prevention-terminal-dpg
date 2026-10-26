import { useState } from "react";

import { parseUploadedDocument } from "../lib/document_api.ts";

interface DocumentUploadPanelProps {
  onContext: (text: string) => void;
  enabled?: boolean;
}

export default function DocumentUploadPanel(props: DocumentUploadPanelProps) {
  const { onContext, enabled = true } = props;
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!enabled) return null;

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".docx") && !file.name.toLowerCase().endsWith(".pdf")) {
      setStatus("Только .docx или .pdf");
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      const { text, structured } = await parseUploadedDocument(file);
      onContext(text);
      setStatus(`Загружено ${text.length} симв.${structured ? " (структура OK)" : ""}`);
    } catch (err) {
      setStatus(String(err));
    } finally {
      setBusy(false);
      e.target.value = "";
    }
  }

  return (
    <section className="card">
      <h2>Документ Word / PDF</h2>
      <p className="muted">Парсинг через headless API (Expert / Architect).</p>
      <input type="file" accept=".docx,.pdf" disabled={busy} onChange={onFile} />
      {status && <p className="muted">{status}</p>}
    </section>
  );
}
