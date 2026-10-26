import React, { useState } from "react";
import { type CloudRecording } from "../../lib/webinars_store.ts";
import { t } from "../../lib/i18n.ts";

interface TildaEmbedCodeModalProps {
  rec: CloudRecording;
  onClose: () => void;
}

export default function TildaEmbedCodeModal({ rec, onClose }: TildaEmbedCodeModalProps) {
  const [includeWatermark, setIncludeWatermark] = useState(true);
  const [customDomain, setCustomDomain] = useState("");
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const baseAcademyUrl = "https://academy.ida-psy.ru";
  
  let playerUrl = `${baseAcademyUrl}/?mode=recording&id=${encodeURIComponent(rec.id)}`;
  if (includeWatermark) {
    playerUrl += `&watermark=1`;
  }
  if (customDomain.trim()) {
    playerUrl += `&allowed_domain=${encodeURIComponent(customDomain.trim())}`;
  }

  const iframeSnippet = `<!-- Видеоплеер IDA Video для Тильды / LMS (Защита от скачивания и водяной знак) -->
<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;background:#090d16;box-shadow:0 12px 36px rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.08);">
  <iframe 
    src="${playerUrl}" 
    style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" 
    allow="autoplay; fullscreen; encrypted-media; picture-in-picture" 
    allowfullscreen>
  </iframe>
</div>`;

  const handleCopy = () => {
    navigator.clipboard.writeText(iframeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "90vh",
          overflowY: "auto",
          padding: "24px 28px",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            <span style={{ fontSize: "0.8rem", background: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "4px", fontWeight: 700 }}>
              {t("Альтернатива внешним видеохостингам", "External Video Host Alternative")}
            </span>
            <h3 style={{ margin: "6px 0 2px 0", fontSize: "1.25rem", fontWeight: 800, color: "#1e293b" }}>
              🎬 {t("Код видеоплеера для Тильды и сайтов", "Video Player Embed Code for Tilda & Sites")}
            </h3>
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b" }}>
              {rec.webinarTitle}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#f1f5f9",
              border: "none",
              borderRadius: "8px",
              padding: "6px 12px",
              cursor: "pointer",
              fontWeight: 700,
              color: "#64748b",
            }}
          >
            ✕
          </button>
        </div>

        {/* Options */}
        <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "0.9rem", color: "#334155", marginBottom: "10px" }}>
            ⚙️ {t("Параметры защиты и показа:", "Protection and Display Settings:")}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", marginBottom: "10px" }}>
            <input
              type="checkbox"
              checked={includeWatermark}
              onChange={(e) => setIncludeWatermark(e.target.checked)}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <span style={{ fontSize: "0.85rem", color: "#1e293b" }}>
              💧 <strong>{t("Динамический водяной знак", "Dynamic Watermark")}</strong> — {t("защищает от съемки экрана и слива на складчины", "prevents screen recording leaks")}
            </span>
          </label>

          <div style={{ marginTop: "10px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
              🔒 {t("Привязать к домену (опционально):", "Restrict to Domain (optional):")}
            </label>
            <input
              type="text"
              placeholder="myschool.ru или mysite.tilda.ws"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "1px solid #cbd5e1",
                fontSize: "0.85rem",
                boxSizing: "border-box",
              }}
            />
            <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
              {t("Если указать домен, плеер не откроется на чужих сайтах.", "If set, player will only play on your allowed domain.")}
            </span>
          </div>
        </div>

        {/* Snippet box */}
        <div style={{ marginBottom: "16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>
              📋 {t("HTML-код для вставки:", "HTML Embed Code:")}
            </span>
            <button
              type="button"
              onClick={handleCopy}
              style={{
                background: copied ? "#10b981" : "#4f46e5",
                color: "#fff",
                border: "none",
                padding: "6px 14px",
                borderRadius: "6px",
                fontWeight: 700,
                fontSize: "0.85rem",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              {copied ? t("✓ Скопировано!", "✓ Copied!") : t("Скопировать код 📋", "Copy Code 📋")}
            </button>
          </div>

          <pre
            style={{
              background: "#090d16",
              color: "#38bdf8",
              padding: "14px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              lineHeight: 1.4,
              overflowX: "auto",
              border: "1px solid #1e293b",
              margin: 0,
            }}
          >
            {iframeSnippet}
          </pre>
        </div>

        {/* Instructions for Tilda & Other CMS */}
        <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "10px", padding: "14px 18px", marginBottom: "16px" }}>
          <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "#1e40af", marginBottom: "6px" }}>
            💡 {t("Как вставить в Тильду (3 простых шага):", "How to Embed in Tilda (3 Simple Steps):")}
          </div>
          <ol style={{ margin: "0 0 10px 0", paddingLeft: "20px", fontSize: "0.8rem", color: "#1e3a8a", lineHeight: 1.6 }}>
            <li>{t("Откройте страницу урока в редакторе Тильды и нажмите «Добавить блок».", "Open your lesson page in Tilda editor and click 'Add Block'.")}</li>
            <li>{t("Выберите раздел «Другое» → блок <strong>T123 (HTML-код)</strong>.", "Select 'Other' → block <strong>T123 (HTML code)</strong>.")}</li>
            <li>{t("Вставьте скопированный код и опубликуйте страницу. Видео защищено от скачивания браузерными плагинами!", "Paste the copied code and publish. Video is shielded from browser downloaders!")}</li>
          </ol>
          <div style={{ background: "rgba(255,255,255,0.7)", borderRadius: "6px", padding: "8px 12px", border: "1px dashed #93c5fd", fontSize: "0.78rem", color: "#1e40af" }}>
            🌐 <strong>{t("WordPress, Битрикс24 и любые другие CMS / CRM:", "WordPress, Bitrix24 & any other CMS / CRM:")}</strong> {t("Этот же HTML-код напрямую поддерживается в блоках «Пользовательский HTML» WordPress, виджетах Битрикс24, Notion и Webflow. Если у вас нестандартная платформа — напишите нам в поддержку, пришлем пошаговую инструкцию под вашу систему.", "This same HTML code works in WordPress 'Custom HTML', Bitrix24, Notion and Webflow. Need help with another CMS/CRM? Request a guide from support anytime.")}
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <a
            href={playerUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: "0.85rem",
              color: "#6366f1",
              textDecoration: "none",
              fontWeight: 600,
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            🔗 {t("Открыть прямую ссылку на плеер", "Open direct player link")} ↗
          </a>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: "#e2e8f0",
              color: "#334155",
              border: "none",
              padding: "8px 18px",
              borderRadius: "8px",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            {t("Закрыть", "Close")}
          </button>
        </div>
      </div>
    </div>
  );
}
